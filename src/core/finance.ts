import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  schools, plans, subscriptions, walletLedger, platformTimeline, outbox, feePayments, students, attendanceRecords,
} from "@/db/schema";
import { getPrices, type Channel } from "@/messaging/wallet";
import { getSettings } from "@/messaging/settings";

/* ─────────────────────────────────────────────────────────────────────────
 * The money (docs/12 §2). Revenue = subscriptions + messaging top-ups and
 * paid-for credits + installation fees. Fees processed (the schools' own
 * money) is activity, never revenue. Everything here is computed from the
 * tables that exist; nothing is written.
 * ──────────────────────────────────────────────────────────────────────── */

export type Stream = "plan" | "messaging" | "installation";
export const STREAM_WORDS: Record<Stream, string> = { plan: "Subscriptions", messaging: "Messaging top-ups", installation: "Installation" };
export const STREAM_COLORS: Record<Stream, string> = { plan: "#A33268", messaging: "#6455CC", installation: "#A8690A" };

export type RevenueEvent = {
  at: Date; schoolId: string; stream: Stream; pesewas: number; reference: string; detail: string;
};

const DAY = 86_400_000;
export const monthKey = (d: Date) => d.toISOString().slice(0, 7);
export const monthLabel = (k: string) => new Date(k + "-15T00:00:00Z").toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
export const ghs = (p: number) => `GHS ${(p / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

/** The last n month keys, oldest first, ending this month. */
export function lastMonths(n: number) {
  const out: string[] = [];
  const d = new Date(); d.setUTCDate(1);
  for (let i = n - 1; i >= 0; i--) out.push(monthKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1))));
  return out;
}

/** Every cedi that came to SchoolSpec, one row each, newest first. */
export async function revenueEvents(schoolId?: string): Promise<RevenueEvent[]> {
  const [subs, credits, installs] = await Promise.all([
    db.select().from(subscriptions).where(schoolId ? eq(subscriptions.schoolId, schoolId) : undefined),
    db.select().from(walletLedger).where(and(
      schoolId ? eq(walletLedger.schoolId, schoolId) : undefined,
      sql`${walletLedger.kind} in ('topup', 'manual')`, sql`${walletLedger.pesewas} > 0`)),
    db.select().from(platformTimeline).where(and(
      schoolId ? eq(platformTimeline.schoolId, schoolId) : undefined,
      eq(platformTimeline.event, "installation"), sql`${platformTimeline.detail} like 'Installation and training paid%'`)),
  ]);
  const out: RevenueEvent[] = [
    ...subs.map((s) => ({ at: s.createdAt, schoolId: s.schoolId, stream: "plan" as const, pesewas: s.amountPesewas,
      reference: s.paystackSubscriptionCode ?? s.id, detail: `${s.planKey} · ${s.cycle === "year" ? "academic year" : "term"} · ${s.periodStart.toISOString().slice(0, 10)} to ${s.periodEnd.toISOString().slice(0, 10)}` })),
    ...credits.map((c) => ({ at: c.createdAt, schoolId: c.schoolId, stream: "messaging" as const, pesewas: c.pesewas,
      reference: c.reference ?? c.id, detail: c.kind === "topup" ? "Top-up by Paystack" : `Credit added by hand${c.note ? `: ${c.note}` : ""}` })),
    // ponytail: no ledger row is written for an installation; the amount is read from the timeline's sentence
    ...installs.map((i) => ({ at: i.createdAt, schoolId: i.schoolId, stream: "installation" as const,
      pesewas: Math.round(Number((/GHS ([\d,]+(?:\.\d+)?)/.exec(i.detail)?.[1] ?? "0").replace(/,/g, "")) * 100),
      reference: i.id, detail: i.detail })),
  ].filter((e) => e.pesewas > 0);
  return out.sort((a, b) => +b.at - +a.at);
}

/** Term price over four months, year over twelve: what a school is worth a month. */
const monthly = (amount: number, cycle: string) => Math.round(amount / (cycle === "year" ? 12 : 4));

/** The recurring base now, and its history month by month with movement. */
export async function mrrSeries(months: string[]) {
  const [subs, allPlans, allSchools] = await Promise.all([
    db.select().from(subscriptions).orderBy(subscriptions.periodStart),
    db.select().from(plans), db.select().from(schools),
  ]);
  const price = new Map(allPlans.map((p) => [p.key, p]));
  // now: every active school at its plan's price
  const nowMrr = allSchools.filter((s) => s.status === "active")
    .reduce((a, s) => a + monthly(price.get(s.planKey)?.pricePerTermPesewas ?? 0, "term"), 0);
  const paying = allSchools.filter((s) => s.status === "active").length;
  // history: subscriptions whose paid period covers the month's end
  const bySchoolMonth = (k: string) => {
    const end = new Date(Date.UTC(Number(k.slice(0, 4)), Number(k.slice(5, 7)), 0, 23, 59, 59));
    const m = new Map<string, number>();
    for (const s of subs) if (s.periodStart <= end && s.periodEnd >= end) m.set(s.schoolId, monthly(s.amountPesewas, s.cycle));
    return m;
  };
  let prev = new Map<string, number>();
  const series = months.map((k, i) => {
    const cur = bySchoolMonth(k);
    if (i === 0) prev = bySchoolMonth(monthKey(new Date(Date.UTC(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 2, 1))));
    let added = 0, expansion = 0, contraction = 0, churned = 0;
    for (const [sid, v] of cur) { const p = prev.get(sid); if (p === undefined) added += v; else if (v > p) expansion += v - p; else if (v < p) contraction += p - v; }
    for (const [sid, p] of prev) if (!cur.has(sid)) churned += p;
    prev = cur;
    return { month: k, mrr: [...cur.values()].reduce((a, b) => a + b, 0), schools: cur.size, added, expansion, contraction, churned };
  });
  return { nowMrr, paying, arpu: paying ? Math.round(nowMrr / paying) : 0, series };
}

/** Signed up → set up → live → paying → lapsed, as counts of schools. */
export async function funnel() {
  const [all, withStudents, withRegisters, everPaid] = await Promise.all([
    db.select({ id: schools.id, status: schools.status, createdAt: schools.createdAt }).from(schools),
    db.select({ id: students.schoolId }).from(students).where(eq(students.status, "active")).groupBy(students.schoolId),
    db.select({ id: attendanceRecords.schoolId }).from(attendanceRecords).groupBy(attendanceRecords.schoolId),
    db.select({ id: subscriptions.schoolId, first: sql<Date>`min(${subscriptions.createdAt})` }).from(subscriptions).groupBy(subscriptions.schoolId),
  ]);
  const s = new Set(withStudents.map((r) => r.id)), r = new Set(withRegisters.map((x) => x.id)), p = new Map(everPaid.map((x) => [x.id, new Date(x.first)]));
  const days = all.filter((x) => p.has(x.id)).map((x) => Math.round((+p.get(x.id)! - +x.createdAt) / DAY)).sort((a, b) => a - b);
  return {
    signedUp: all.length, setUp: all.filter((x) => s.has(x.id)).length, live: all.filter((x) => r.has(x.id)).length,
    paidEver: p.size, payingNow: all.filter((x) => x.status === "active").length,
    lapsed: all.filter((x) => ["suspended", "expired"].includes(x.status)).length,
    medianDaysToPay: days.length ? days[Math.floor(days.length / 2)] : null,
  };
}

/** Who is due, who is late, who went quiet. */
export async function renewals() {
  const [allSchools, subs] = await Promise.all([
    db.select().from(schools), db.select().from(subscriptions).orderBy(desc(subscriptions.periodEnd)),
  ]);
  const latest = new Map<string, typeof subs[number]>();
  for (const s of subs) if (!latest.has(s.schoolId)) latest.set(s.schoolId, s);
  const now = Date.now();
  const row = (s: typeof allSchools[number]) => {
    const l = latest.get(s.id);
    return { school: s, sub: l, daysToEnd: l ? Math.round((+l.periodEnd - now) / DAY) : null };
  };
  const rows = allSchools.map(row);
  return {
    dueSoon: rows.filter((r) => r.school.status === "active" && r.daysToEnd !== null && r.daysToEnd >= 0 && r.daysToEnd <= 30).sort((a, b) => a.daysToEnd! - b.daysToEnd!),
    pastDue: rows.filter((r) => r.school.status === "past_due").sort((a, b) => a.daysToEnd! - b.daysToEnd!),
    lapsed: rows.filter((r) => ["suspended", "expired"].includes(r.school.status)),
    trials: rows.filter((r) => r.school.status === "trial"),
  };
}

/** Messaging: charged to schools against what the providers cost, by month. */
export async function messagingEconomics(months: string[]) {
  const since = new Date(months[0] + "-01T00:00:00Z");
  const [rows, prices] = await Promise.all([
    db.select({
      month: sql<string>`to_char(${outbox.createdAt}, 'YYYY-MM')`, channel: outbox.channel,
      n: sql<number>`count(*)`, parts: sql<number>`coalesce(sum(${outbox.parts}),0)`, charged: sql<number>`coalesce(sum(${outbox.pricePesewas}),0)`,
    }).from(outbox).where(and(gte(outbox.createdAt, since), sql`${outbox.status} not in ('held','failed')`))
      .groupBy(sql`to_char(${outbox.createdAt}, 'YYYY-MM')`, outbox.channel),
    getPrices(),
  ]);
  // ponytail: cost uses today's cost per channel, not the cost on the day of each send
  return months.map((m) => {
    const here = rows.filter((r) => r.month === m);
    const charged = here.reduce((a, r) => a + Number(r.charged), 0);
    const cost = here.reduce((a, r) => a + (r.channel === "sms" ? Number(r.parts) : Number(r.n)) * (prices[r.channel as Channel]?.costPesewas ?? 0), 0);
    return { month: m, messages: here.reduce((a, r) => a + Number(r.n), 0), charged, cost, margin: charged - cost };
  });
}

/** Schools by signup month: how many still pay now, how many ever paid. */
export async function cohorts(months: string[]) {
  const [all, everPaid] = await Promise.all([
    db.select({ id: schools.id, status: schools.status, createdAt: schools.createdAt }).from(schools),
    db.select({ id: subscriptions.schoolId }).from(subscriptions).groupBy(subscriptions.schoolId),
  ]);
  const paid = new Set(everPaid.map((x) => x.id));
  return months.map((m) => {
    const c = all.filter((s) => monthKey(s.createdAt) === m);
    return { month: m, signedUp: c.length, paidEver: c.filter((s) => paid.has(s.id)).length, payingNow: c.filter((s) => s.status === "active").length };
  });
}

/** One row per school: what it has paid, spent and processed. */
export async function perSchool() {
  const [allSchools, events, subs, charged, gmv, roll] = await Promise.all([
    db.select().from(schools).orderBy(schools.name), revenueEvents(),
    db.select().from(subscriptions).orderBy(desc(subscriptions.periodEnd)),
    db.select({ schoolId: walletLedger.schoolId, n: sql<number>`coalesce(-sum(${walletLedger.pesewas}),0)` })
      .from(walletLedger).where(eq(walletLedger.kind, "charge")).groupBy(walletLedger.schoolId),
    db.select({ schoolId: feePayments.schoolId, n: sql<number>`coalesce(sum(${feePayments.amountPesewas}),0)` })
      .from(feePayments).where(sql`${feePayments.voidedBy} is null`).groupBy(feePayments.schoolId),
    db.select({ schoolId: students.schoolId, n: sql<number>`count(*)` }).from(students).where(eq(students.status, "active")).groupBy(students.schoolId),
  ]);
  const latest = new Map<string, typeof subs[number]>();
  for (const s of subs) if (!latest.has(s.schoolId)) latest.set(s.schoolId, s);
  const sum = (xs: { schoolId: string; n: number }[]) => new Map(xs.map((x) => [x.schoolId, Number(x.n)]));
  const spent = sum(charged), fees = sum(gmv), students_ = sum(roll);
  return allSchools.map((s) => {
    const mine = events.filter((e) => e.schoolId === s.id);
    const l = latest.get(s.id);
    return {
      school: s, students: students_.get(s.id) ?? 0,
      lifetime: mine.reduce((a, e) => a + e.pesewas, 0),
      plan: mine.filter((e) => e.stream === "plan").reduce((a, e) => a + e.pesewas, 0),
      messaging: mine.filter((e) => e.stream === "messaging").reduce((a, e) => a + e.pesewas, 0),
      installation: mine.filter((e) => e.stream === "installation").reduce((a, e) => a + e.pesewas, 0),
      lastPaid: mine[0]?.at ?? null, nextRenewal: l?.periodEnd ?? null, cycle: l?.cycle ?? null,
      messagingSpent: spent.get(s.id) ?? 0, feesProcessed: fees.get(s.id) ?? 0,
    };
  });
}

export async function revenueTarget() {
  return Number((await getSettings()).revenue_target_pesewas) || 0;
}
