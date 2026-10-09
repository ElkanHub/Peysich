import { cache } from "react";
import { and, eq, inArray, isNull, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  academicYears, terms, schools, staff, user as userTable, students, reportCards, feeInvoices,
  attendanceRecords, subscriptions, platformAuditLogs,
} from "@/db/schema";
import { termWeeks, todayIso } from "./calendar";
import { uid } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────────
 * The cycle of use (docs/11-term-lifecycle-and-archives.md).
 *   upcoming → open → ended → closed
 * A term is OPEN from the day it starts (the sweep opens it, or the admin
 * opens it early) until its last day; ENDED after that, still correctable
 * for CORRECTION_DAYS; CLOSED once the admin closes it, and then it lives in
 * Archives, read-only, except for fee payments against its invoices.
 * The school is FROZEN — nothing new is written anywhere — when no term can
 * take writes or the subscription has lapsed.
 * ──────────────────────────────────────────────────────────────────────── */

export type TermRow = typeof terms.$inferSelect;
export type TermState = "upcoming" | "open" | "ended" | "closed";
export const CORRECTION_DAYS = 21;
/** How long a lapsed school stays readable before its data goes (docs/11 §2.7). */
export const RETENTION_DAYS = 365;
export const RETENTION_WARNINGS = [90, 30, 7];

const DAY = 86_400_000;
export const addDays = (iso: string, n: number) =>
  new Date(Date.parse(iso + "T00:00:00Z") + n * DAY).toISOString().slice(0, 10);

/** Pure: where a term is in its life on a given day. */
export function termState(t: Pick<TermRow, "startsAt" | "endsAt" | "openedAt" | "closedAt">, today = todayIso()): TermState {
  if (t.closedAt) return "closed";
  if (!t.openedAt) return "upcoming";
  return today > t.endsAt ? "ended" : "open";
}

/** Pure: may anything new be recorded in this term today? Open terms yes;
 *  ended terms for the correction window; upcoming and closed never. */
export function termWritable(t: Pick<TermRow, "startsAt" | "endsAt" | "openedAt" | "closedAt">, today = todayIso()) {
  const s = termState(t, today);
  return s === "open" || (s === "ended" && today <= addDays(t.endsAt, CORRECTION_DAYS));
}

/** Pure: the plain sentence a refused write shows. */
export function whyNotWritable(t: Pick<TermRow, "name" | "startsAt" | "endsAt" | "openedAt" | "closedAt">, today = todayIso()) {
  const s = termState(t, today);
  if (s === "closed") return `${t.name} is closed. Nothing new can be recorded in it.`;
  if (s === "upcoming") return `${t.name} has not opened yet. It opens on ${fmtDay(t.startsAt)}.`;
  if (s === "ended") return `${t.name} ended on ${fmtDay(t.endsAt)}. Close it and open the next term to carry on.`;
  return "";
}

/** Pure: a school whose subscription has lapsed is read-only (docs/11 §2.8). */
export const schoolWritable = (status: string) => status === "trial" || status === "active" || status === "past_due";

export const fmtDay = (iso: string) =>
  new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long" });

/** Every term of a school with its year, newest first. */
export const listTerms = cache(async (schoolId: string) => {
  const [ts, ys] = await Promise.all([
    db.select().from(terms).where(eq(terms.schoolId, schoolId)),
    db.select().from(academicYears).where(eq(academicYears.schoolId, schoolId)),
  ]);
  const yearOf = new Map(ys.map((y) => [y.id, y]));
  return ts.map((t) => ({ ...t, year: yearOf.get(t.yearId)!, state: termState(t) }))
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
});

/** The term the school stands on. The one that is open (or ended and not yet
 *  closed) wins; with none, the most recently closed one, so every page still
 *  has something to read; with nothing opened yet, the first upcoming term. */
export const getWorkingTerm = cache(async (schoolId: string) => {
  const all = await listTerms(schoolId);
  if (!all.length) return null;
  const t = all.find((x) => x.state === "open" || x.state === "ended")
    ?? all.find((x) => x.state === "closed")
    ?? [...all].reverse().find((x) => x.state === "upcoming")
    ?? all[0];
  return { ...t, writable: termWritable(t) };
});

/** The term a page is looking at: the working term, or the one named in the
 *  URL (?t=) when it belongs to this school. `viewingPast` drives the banner. */
export async function getViewingTerm(schoolId: string, t?: string) {
  const working = await getWorkingTerm(schoolId);
  if (!working) return null;
  if (!t || t === working.id) return { ...working, viewingPast: false };
  const all = await listTerms(schoolId);
  const chosen = all.find((x) => x.id === t);
  if (!chosen) return { ...working, viewingPast: false };
  return { ...chosen, writable: false, viewingPast: true };
}

/** The write guard every action goes through: the working term, or a plain
 *  sentence thrown when nothing may be recorded today. */
export async function requireWritableTerm(school: { id: string; status: string }) {
  if (!schoolWritable(school.status))
    throw new Error("The school's subscription has ended. Everything is kept and readable; renew to record anything new.");
  const t = await getWorkingTerm(school.id);
  if (!t) throw new Error("Set up the academic year and term dates first.");
  if (!t.writable) throw new Error(whyNotWritable(t));
  return t;
}

/** Is a date inside the term? Registers may not be marked outside it. */
export const inTerm = (t: Pick<TermRow, "startsAt" | "endsAt">, iso: string) => iso >= t.startsAt && iso <= t.endsAt;

/* ── the ceremonies ── */

export async function openTerm(schoolId: string, termId: string, by: string) {
  const all = await listTerms(schoolId);
  const t = all.find((x) => x.id === termId);
  if (!t) throw new Error("No such term.");
  if (t.state !== "upcoming") throw new Error(`${t.name} is already ${t.state}.`);
  const open = all.find((x) => x.state === "open" || x.state === "ended");
  if (open) throw new Error(`Close ${open.name} first — one term at a time.`);
  await db.update(terms).set({ openedAt: new Date(), isCurrent: true }).where(eq(terms.id, termId));
  await db.update(terms).set({ isCurrent: false }).where(and(eq(terms.schoolId, schoolId), sql`${terms.id} != ${termId}`));
  await db.update(academicYears).set({ isCurrent: false }).where(eq(academicYears.schoolId, schoolId));
  await db.update(academicYears).set({ isCurrent: true }).where(eq(academicYears.id, t.yearId));
  await audit(schoolId, by, "term.open", { termId, termName: t.name, year: t.year.name });
  await pingTeam(schoolId, "term_opened", { term: t.name, year: t.year.name, ends: fmtDay(t.endsAt) }, "/");
}

/** What the term produced, written once at close and shown in Archives. */
export async function summarise(schoolId: string, t: TermRow) {
  const [[st], [rc], [fees], [att]] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(students)
      .where(and(eq(students.schoolId, schoolId), eq(students.status, "active"))),
    db.select({ n: sql<number>`count(*)` }).from(reportCards)
      .where(and(eq(reportCards.termId, t.id), eq(reportCards.published, true))),
    db.select({ paid: sql<number>`coalesce(sum(${feeInvoices.paidPesewas}),0)`, total: sql<number>`coalesce(sum(${feeInvoices.totalPesewas}),0)` })
      .from(feeInvoices).where(eq(feeInvoices.termId, t.id)),
    db.select({ present: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'present')`, all: sql<number>`count(*)` })
      .from(attendanceRecords).where(eq(attendanceRecords.termId, t.id)),
  ]);
  return {
    students: Number(st.n), reportCards: Number(rc.n),
    collectedPesewas: Number(fees.paid), outstandingPesewas: Math.max(0, Number(fees.total) - Number(fees.paid)),
    attendanceRate: Number(att.all) ? Math.round((Number(att.present) / Number(att.all)) * 100) : null,
    weeks: termWeeks(t).length,
  };
}

export async function closeTerm(schoolId: string, termId: string, by: { id: string; name: string }) {
  const all = await listTerms(schoolId);
  const t = all.find((x) => x.id === termId);
  if (!t) throw new Error("No such term.");
  if (t.state === "closed") throw new Error(`${t.name} is already closed.`);
  if (t.state === "upcoming") throw new Error(`${t.name} has not opened yet.`);
  const summary = await summarise(schoolId, t);
  await db.update(terms).set({ closedAt: new Date(), closedBy: by.name, scoresLocked: true, closeSummary: summary, isCurrent: false })
    .where(eq(terms.id, termId));
  await audit(schoolId, by.id, "term.close", { termId, termName: t.name, year: t.year.name, ...summary });
  await pingTeam(schoolId, "term_closed", { term: t.name, year: t.year.name, reports: String(summary.reportCards) }, "/archives");
  return summary;
}

export async function reopenTerm(schoolId: string, termId: string, by: { id: string; name: string }, reason: string) {
  const all = await listTerms(schoolId);
  const t = all.find((x) => x.id === termId);
  if (!t || t.state !== "closed") throw new Error("Only a closed term can be reopened.");
  const open = all.find((x) => x.state === "open" || x.state === "ended");
  if (open) throw new Error(`Close ${open.name} first — one term at a time.`);
  await db.update(terms).set({ closedAt: null, closedBy: null, closeSummary: null, scoresLocked: false }).where(eq(terms.id, termId));
  await db.update(academicYears).set({ closedAt: null }).where(eq(academicYears.id, t.yearId));
  await audit(schoolId, by.id, "term.reopen", { termId, termName: t.name, year: t.year.name, reason, by: by.name });
  await pingTeam(schoolId, "term_reopened", { term: t.name, year: t.year.name, who: by.name }, "/");
}

/** A year closes only when all its terms have. Returns false if one is open. */
export async function closeYearIfDone(schoolId: string, yearId: string) {
  const open = (await listTerms(schoolId)).filter((t) => t.yearId === yearId && t.state !== "closed");
  if (open.length) return false;
  await db.update(academicYears).set({ closedAt: new Date(), isCurrent: false }).where(eq(academicYears.id, yearId));
  return true;
}

async function audit(schoolId: string, actorUserId: string, action: string, detail: Record<string, unknown>) {
  await db.insert(platformAuditLogs).values({ id: uid(), actorUserId, action, schoolId, detail });
}

/** A ping to the admins and their team, nobody else (docs/11): every admin
 *  login that has a staff record. The app and Telegram are free; the paid
 *  channels follow the school's own routing. */
export async function pingTeam(schoolId: string, kind: "term_opened" | "term_closed" | "term_reopened" | "term_close_due" | "retention_warning",
  vars: Record<string, string>, url: string) {
  const [school] = await db.select({ id: schools.id, name: schools.name, branding: schools.branding }).from(schools).where(eq(schools.id, schoolId));
  if (!school) return;
  const admins = await db.select({ id: userTable.id }).from(userTable)
    .where(and(eq(userTable.schoolId, schoolId), eq(userTable.role, "admin")));
  if (!admins.length) return;
  const team = await db.select({ id: staff.id }).from(staff)
    .where(and(eq(staff.schoolId, schoolId), inArray(staff.userId, admins.map((a) => a.id))));
  if (!team.length) return; // ponytail: an admin without a staff record gets no ping; the Staff page creates one
  const { notifyMany } = await import("@/messaging/notify");
  const { schoolUrl } = await import("@/messaging/render");
  const [{ slug }] = await db.select({ slug: schools.slug }).from(schools).where(eq(schools.id, schoolId));
  await notifyMany({ id: school.id, name: school.name, branding: school.branding },
    team.map((s) => ({ to: { kind: "staff" as const, id: s.id }, kind, vars: { ...vars, school: school.name }, url, link: schoolUrl(slug, url) })));
}

/* ── the daily sweep (runs after the dunning sweep) ── */

/** Opens terms whose first day has come, reminds about terms left unclosed,
 *  and warns lapsed schools before their data goes. */
export async function termSweep(today = todayIso()) {
  const all = await db.select().from(schools);
  for (const s of all) {
    const ts = await db.select().from(terms).where(eq(terms.schoolId, s.id));
    const live = ts.find((t) => { const st = termState(t, today); return st === "open" || st === "ended"; });
    // a term's first day: open it, if the school may write and nothing else is open
    if (!live && schoolWritable(s.status)) {
      const due = ts.filter((t) => termState(t, today) === "upcoming" && t.startsAt <= today)
        .sort((a, b) => b.startsAt.localeCompare(a.startsAt))[0];
      if (due) await openTerm(s.id, due.id, "sweep").catch(() => {});
    }
    // the correction window ran out: say so, once
    if (live && termState(live, today) === "ended" && today === addDays(live.endsAt, CORRECTION_DAYS))
      await pingTeam(s.id, "term_close_due", { term: live.name }, "/");
    // lapsed: count down to deletion (the deletion itself is a decision taken by hand — ponytail)
    if (s.status === "suspended" || s.status === "expired") {
      const until = await deleteAfter(s);
      if (!until) continue;
      const left = Math.round((Date.parse(until) - Date.parse(today)) / DAY);
      if (RETENTION_WARNINGS.includes(left))
        await pingTeam(s.id, "retention_warning", { days: String(left), date: fmtDay(until) }, "/billing");
    }
  }
}

/** The day a lapsed school's records are due to go: a year after the last
 *  paid day (or the trial's end). */
export async function deleteAfter(s: { id: string; trialEndsAt: Date | null }) {
  const [sub] = await db.select({ end: subscriptions.periodEnd }).from(subscriptions)
    .where(eq(subscriptions.schoolId, s.id)).orderBy(sql`${subscriptions.periodEnd} desc`).limit(1);
  const last = sub?.end ?? s.trialEndsAt;
  return last ? addDays(last.toISOString().slice(0, 10), RETENTION_DAYS) : null;
}

/** Terms that have run past the correction window and are still not closed —
 *  what Home nags about. */
export async function unclosedTerms(schoolId: string, today = todayIso()) {
  return (await listTerms(schoolId)).filter((t) => t.state === "ended" && today > addDays(t.endsAt, CORRECTION_DAYS));
}

// keep the drizzle helpers referenced for the sweep's narrower selects
void isNull; void isNotNull;
