import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { schools, terms, academicYears } from "@/db/schema";
import { and } from "drizzle-orm";
import { getSession } from "@/core/session";
import { getAdminGrants } from "@/core/access";
import { getSnapshot, type Snapshot } from "@/modules/analytics/compute";

export const runtime = "nodejs";

const esc = (v: string | number | null) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const rows = (r: (string | number | null)[][]) => r.map((row) => row.map(esc).join(",")).join("\n");

/** Raw CSV of a pillar's tables — same numbers the dashboard shows.
 *  Admins with the Analytics grant only. */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const user = session.user as { id: string; role: string; schoolId?: string | null };
  if (user.role !== "admin" || !user.schoolId)
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const [school] = await db.select().from(schools).where(eq(schools.id, user.schoolId));
  if (!school) return NextResponse.json({ error: "No school" }, { status: 404 });
  const g = await getAdminGrants(school.id, user.id);
  if (g && !g.tabs.has("analytics"))
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  // current term, same derivation the app uses (date-based, isCurrent honored)
  const today = new Date().toISOString().slice(0, 10);
  const allTerms = await db.select({
    id: terms.id, name: terms.name, startsAt: terms.startsAt, endsAt: terms.endsAt,
    yearName: academicYears.name,
  }).from(terms)
    .innerJoin(academicYears, eq(terms.yearId, academicYears.id))
    .where(and(eq(terms.schoolId, school.id)));
  const cur = allTerms.find((t) => t.startsAt <= today && t.endsAt >= today) ?? null;
  const snap = await getSnapshot(school,
    cur ? { ...cur, year: { name: cur.yearName } } : null);

  const tab = req.nextUrl.searchParams.get("tab") ?? "overview";
  const out = csvFor(snap, tab);
  return new NextResponse(out, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="peysich-analytics-${tab}-${snap.day}.csv"`,
    },
  });
}

function csvFor(s: Snapshot, tab: string): string {
  const ghs = (p: number) => (p / 100).toFixed(2);
  switch (tab) {
    case "money":
      return rows([
        ["Money", s.termLabel, s.day],
        ["Billed (GHS)", ghs(s.money.billed)], ["Collected (GHS)", ghs(s.money.collected)],
        ["Outstanding (GHS)", ghs(s.money.outstanding)], ["Owing students", s.money.owingStudents],
        ["Forecast (GHS)", ghs(s.money.forecast)],
        [],
        ["Aging bucket", "Outstanding (GHS)"],
        ...s.money.aging.map((a) => [a.label, ghs(a.v)] as (string | number)[]),
        [],
        ["Channel", "Collected (GHS)"],
        ...s.money.channels.map((c) => [c.label, ghs(c.v)] as (string | number)[]),
        [],
        ["Class", "Billed", "Collected", "Outstanding", "Owing students", "Roster"],
        ...s.money.byClass.map((c) =>
          [c.name, ghs(c.billed), ghs(c.collected), ghs(c.outstanding), c.owing, c.of] as (string | number)[]),
      ]);
    case "learning":
      return rows([
        ["Learning", s.termLabel, s.day],
        ["School average %", s.learning.schoolAvg], ["Students scored", s.learning.studentsScored],
        [],
        ["Subject", "Average %", "Entries"],
        ...s.learning.subjects.map((r) => [r.name, r.avg, r.n] as (string | number)[]),
        [],
        ["Grade", "Students"],
        ...s.learning.grades.map((r) => [r.grade, r.n] as (string | number)[]),
        [],
        ["Teacher", "Subject", "Classes", "Average %", "vs subject avg"],
        ...s.learning.teachers.map((t) => [t.name, t.subject, t.classes, t.avg, t.delta] as (string | number)[]),
        [],
        ["At-risk student", "Class", "Average %", "Days missed", "Days marked"],
        ...s.learning.atRisk.map((r) => [r.name, r.className, r.avg, r.missed, r.of] as (string | number | null)[]),
      ]);
    case "attendance":
      return rows([
        ["Attendance", s.termLabel, s.day],
        ["Term-to-date %", s.attendance.rate],
        [],
        ["Week", "% present"],
        ...s.attendance.weekly.map((w) => [w.label, w.v] as (string | number | null)[]),
        [],
        ["Class", ...s.attendance.heat.cols.map((c) => `${c} % absent`)],
        ...s.attendance.heat.rows.map((r, i) =>
          [r, ...s.attendance.heat.cells[i]] as (string | number | null)[]),
        [],
        ["Chronic absentee", "Class", "Days missed", "Days marked"],
        ...s.attendance.chronic.map((r) => [r.name, r.className, r.missed, r.of] as (string | number)[]),
      ]);
    case "people":
      return rows([
        ["People", s.termLabel, s.day],
        ["Enrolled", s.people.enrolled], ["Retention %", s.people.retention],
        ["Girls", s.people.gender.female], ["Boys", s.people.gender.male],
        ["Transport riders", s.people.transportRiders],
        [],
        ["Funnel stage", "Count"],
        ...s.people.funnel.map((f) => [f.label, f.v] as (string | number)[]),
        [],
        ["Exit reason", "Count"],
        ...s.people.exits.map((e) => [e.reason, e.n] as (string | number)[]),
        [],
        ["Level", "Enrolled"],
        ...s.people.byLevel.map((l) => [l.name, l.n] as (string | number)[]),
      ]);
    case "operations":
      return rows([
        ["Operations", s.termLabel, s.day],
        ["Library copies", s.operations.library.books],
        ["Out on loan", s.operations.library.out], ["Overdue", s.operations.library.overdue],
        [],
        ["Teacher", "Periods/week", "Students"],
        ...s.operations.teacherLoad.map((t) => [t.name, t.periods, t.students] as (string | number)[]),
        [],
        ["Route", "Riders"],
        ...s.operations.routes.map((r) => [r.name, r.riders] as (string | number)[]),
      ]);
    default:
      return rows([
        ["Overview", s.termLabel, s.day],
        ["Billed (GHS)", ghs(s.money.billed)], ["Collected (GHS)", ghs(s.money.collected)],
        ["Attendance %", s.attendance.rate], ["School average %", s.learning.schoolAvg],
        ["At-risk students", s.learning.atRisk.length], ["Enrolled", s.people.enrolled],
        ["Applied", s.people.funnel[0]?.v ?? 0], ["Admitted", s.people.funnel[3]?.v ?? 0],
      ]);
  }
}
