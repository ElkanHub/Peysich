import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { plans, schools, subscriptions, feeCheckouts, feePayments } from "@/db/schema";
import { invalidateModules } from "./entitlements";
import { CYCLE_MONTHS, type Cycle } from "./plan-const";
import { uid } from "@/lib/utils";

/* ── The billing cycles ─────────────────────────────────────────────────────
   A school pays by the TERM (four months of cover: the term and the holiday
   after it) or by the ACADEMIC YEAR (twelve months). Periods count from the
   day of payment, not from fixed term dates:

   · first payment, or paying after being suspended → the period starts today
   · renewing the same plan, early or up to 14 days late → the new period
     starts where the current one ends, so no day is lost or given away
   · changing plan mid-period → the new plan starts today, and the unused
     days of the old one are credited against its price; credit beyond the
     price becomes extra days                                              */

const DAY = 86400000;
export const GRACE_DAYS = 14; // what the payment_failed message tells the head (MESSAGING_SETUP.md §7)
const addMonths = (d: Date, n: number) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };

export type PlanQuote = { start: Date; end: Date; pricePesewas: number; creditPesewas: number; chargePesewas: number };

/** The period and the charge for one payment. Pure: the rules above, nothing else. */
export function planPeriod(o: {
  now: Date; cycle: Cycle; pricePesewas: number; suspended: boolean; samePlan: boolean;
  /** the school's latest period and what that period was worth */
  current?: { periodStart: Date; periodEnd: Date; valuePesewas: number };
}): PlanQuote {
  const months = CYCLE_MONTHS[o.cycle], price = o.pricePesewas, c = o.current;
  const fresh = (): PlanQuote =>
    ({ start: o.now, end: addMonths(o.now, months), pricePesewas: price, creditPesewas: 0, chargePesewas: price });
  if (!c || o.suspended || +o.now > +c.periodEnd + GRACE_DAYS * DAY) return fresh();
  if (o.samePlan) return { ...fresh(), start: c.periodEnd, end: addMonths(c.periodEnd, months) };
  // a different plan: starts today; whole unused days of the old period are credited
  const total = Math.max(1, Math.round((+c.periodEnd - +c.periodStart) / DAY));
  const left = Math.max(0, Math.floor((+c.periodEnd - +o.now) / DAY));
  const credit = Math.round(c.valuePesewas * Math.min(1, left / total));
  const end = addMonths(o.now, months);
  const perDay = price / Math.max(1, Math.round((+end - +o.now) / DAY));
  const extraDays = credit > price && perDay > 0 ? Math.floor((credit - price) / perDay) : 0;
  return {
    start: o.now, end: new Date(+end + extraDays * DAY), pricePesewas: price,
    creditPesewas: Math.min(credit, price), chargePesewas: Math.max(0, price - credit),
  };
}

/** planPeriod() for a real school: its status, its latest period and what that was worth. */
export async function quotePlan(schoolId: string, plan: typeof plans.$inferSelect, cycle: Cycle, now = new Date()): Promise<PlanQuote> {
  const [[school], [latest]] = await Promise.all([
    db.select({ status: schools.status }).from(schools).where(eq(schools.id, schoolId)),
    db.select().from(subscriptions).where(eq(subscriptions.schoolId, schoolId)).orderBy(desc(subscriptions.periodEnd)).limit(1),
  ]);
  let value = latest?.amountPesewas ?? 0;
  if (latest && (latest.cycle === "term" || latest.cycle === "year")) {
    // what the period is worth is the plan's price, not what was charged after a credit
    const [old] = await db.select().from(plans).where(eq(plans.key, latest.planKey));
    if (old) value = latest.cycle === "year" ? old.pricePerYearPesewas : old.pricePerTermPesewas;
  }
  return planPeriod({
    now, cycle, pricePesewas: cycle === "year" ? plan.pricePerYearPesewas : plan.pricePerTermPesewas,
    suspended: school?.status === "suspended", samePlan: latest?.planKey === plan.key,
    current: latest && { periodStart: latest.periodStart, periodEnd: latest.periodEnd, valuePesewas: value },
  });
}

/** Fulfillment: called by webhook AND fake-pay route. Idempotent by reference. */
export async function applySubscription(
  schoolId: string, planKey: string, reference: string, cycle: Cycle = "term",
) {
  const [existing] = await db.select().from(subscriptions)
    .where(eq(subscriptions.paystackSubscriptionCode, reference));
  if (existing) return; // already fulfilled
  const [plan] = await db.select().from(plans).where(eq(plans.key, planKey));
  if (!plan) throw new Error("Unknown plan");
  const now = new Date();
  const q = await quotePlan(schoolId, plan, cycle, now);
  await db.insert(subscriptions).values({
    id: uid(), schoolId, planKey, status: "active", cycle,
    amountPesewas: q.chargePesewas,
    periodStart: q.start, periodEnd: q.end, paystackSubscriptionCode: reference,
  });
  await db.update(schools).set({
    planKey, status: "active",
    studentCap: plan.studentCap ?? 100000, storageCapMb: plan.storageCapMb,
    updatedAt: now,
  }).where(eq(schools.id, schoolId));
  invalidateModules(schoolId);
  const { onPlanPaid } = await import("@/messaging/platform");
  await onPlanPaid(schoolId, plan.name, q.chargePesewas, q.end);
}

/** Dunning sweep (Vercel Cron in prod): trial/period expiry → suspend. */
export async function dunningSweep() {
  const now = new Date();
  const all = await db.select().from(schools);
  for (const s of all) {
    if (s.status === "trial" && s.trialEndsAt && s.trialEndsAt < now) {
      await db.update(schools).set({ status: "expired" }).where(eq(schools.id, s.id));
      continue;
    }
    if (s.status !== "active") continue;
    const subs = await db.select().from(subscriptions).where(eq(subscriptions.schoolId, s.id));
    const latest = subs.sort((a, b) => +b.periodEnd - +a.periodEnd)[0];
    if (!latest) continue;
    const grace = new Date(latest.periodEnd); grace.setDate(grace.getDate() + GRACE_DAYS);
    if (now > grace) await db.update(schools).set({ status: "suspended" }).where(eq(schools.id, s.id));
    else if (now > latest.periodEnd) await db.update(schools).set({ status: "past_due" }).where(eq(schools.id, s.id));
  }
}

/** Fulfillment for parent fee payments (webhook + fake-pay). Idempotent. */
export async function applyFeePayment(reference: string) {
  const [c] = await db.select().from(feeCheckouts).where(eq(feeCheckouts.reference, reference));
  if (!c) return;
  const [existing] = await db.select().from(feePayments).where(eq(feePayments.reference, reference));
  if (existing) return;
  const [school] = await db.select().from(schools).where(eq(schools.id, c.schoolId));
  if (!school) return;
  // same path as the cashier's desk: receipt number, ledger row, SMS to the parent
  const { recordPaymentFor, sendReceiptSms } = await import("@/modules/fees/engine");
  const r = await recordPaymentFor(school, {
    invoiceId: c.invoiceId, amountPesewas: c.amountPesewas, method: "momo", reference,
  });
  if (r) await sendReceiptSms(school, { ...r, amountPesewas: c.amountPesewas });
}
