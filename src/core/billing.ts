import { eq } from "drizzle-orm";
import { db } from "@/db";
import { plans, schools, subscriptions, feeCheckouts, feePayments } from "@/db/schema";
import { invalidateModules } from "./entitlements";
import { uid } from "@/lib/utils";

/** Fulfillment: called by webhook AND fake-pay route. Idempotent by reference. */
export async function applySubscription(
  schoolId: string, planKey: string, reference: string, cycle: "monthly" | "yearly" = "monthly",
) {
  const [existing] = await db.select().from(subscriptions)
    .where(eq(subscriptions.paystackSubscriptionCode, reference));
  if (existing) return; // already fulfilled
  const [plan] = await db.select().from(plans).where(eq(plans.key, planKey));
  if (!plan) throw new Error("Unknown plan");
  const now = new Date();
  const end = new Date(now);
  if (cycle === "yearly") end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);
  await db.insert(subscriptions).values({
    id: uid(), schoolId, planKey, status: "active", cycle,
    amountPesewas: cycle === "yearly" ? plan.pricePerYearPesewas : plan.pricePerMonthPesewas,
    periodStart: now, periodEnd: end, paystackSubscriptionCode: reference,
  });
  await db.update(schools).set({
    planKey, status: "active",
    studentCap: plan.studentCap ?? 100000, storageCapMb: plan.storageCapMb,
    updatedAt: now,
  }).where(eq(schools.id, schoolId));
  invalidateModules(schoolId);
  const { onPlanPaid } = await import("@/messaging/platform");
  await onPlanPaid(schoolId, plan.name, cycle === "yearly" ? plan.pricePerYearPesewas : plan.pricePerMonthPesewas, end);
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
    // 14 days: what the payment_failed message tells the head (MESSAGING_SETUP.md §7)
    const grace = new Date(latest.periodEnd); grace.setDate(grace.getDate() + 14);
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
