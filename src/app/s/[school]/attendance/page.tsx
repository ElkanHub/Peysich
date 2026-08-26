import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, sql, inArray, asc } from "drizzle-orm";
import { db } from "@/db";
import { classes, levels, students, subjects, attendanceRecords, staff, teachingAssignments } from "@/db/schema";
import { requireModule, getTeacherScope } from "@/core/school-context";
import { Card, PageHeader, Empty, btnCls } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";
import { remindClassTeacher, nudgesTodayByClass } from "./actions";

const ERR: Record<string, string> = {
  noteacher: "That class has no class teacher yet — assign one on Teaching & allocations first.",
  weekend: "That day is a weekend — school records run Monday to Friday only.",
  holiday: "That day is marked as a holiday, so there is no register to keep.",
  notallowed: "Only an admin can correct a past day's register.",
};

const hhmm = (d: Date) =>
  d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Accra" });

/** Green/amber/red split of a marked register, as one slim bar. */
function RateBar({ present, late, absent, total }: { present: number; late: number; absent: number; total: number }) {
  if (!total) return null;
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-border/60">
      <div className="bg-success" style={{ width: `${(present / total) * 100}%` }} />
      <div className="bg-warning" style={{ width: `${(late / total) * 100}%` }} />
      <div className="bg-danger" style={{ width: `${(absent / total) * 100}%` }} />
    </div>
  );
}

/** "18 present · 1 late · 2 absent" with only the parts that exist. */
function Breakdown({ present, late, absent }: { present: number; late: number; absent: number }) {
  return (
    <p className="text-[13.5px]" data-nums="">
      <span className="text-success">{present} present</span>
      {late > 0 && <span className="text-warning"> · {late} late</span>}
      {absent > 0 && <span className="font-medium text-danger"> · {absent} absent</span>}
    </p>
  );
}

/** Attendance home. Teachers: THEIR register(s) to mark, plus a muted list
 *  of subject-only classes (no marking — that's the class teacher's job).
 *  Admins: a monitoring board — school pulse up top, unmarked registers
 *  called out with one-tap reminders, marked ones showing the full picture. */
export default async function Attendance({ params, searchParams }: {
  params: Promise<{ school: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  const { school: slug } = await params;
  const { err } = await searchParams;
  const { school, user } = await requireModule(slug, "attendance");
  // families come here for their own record — that lives in the record book
  if (user.role === "parent" || user.role === "student") redirect("/attendance/register");
  const today = new Date().toISOString().slice(0, 10);
  const dateLabel = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Accra",
  });
  const isTeacher = user.role === "teacher";
  const scope = isTeacher ? await getTeacherScope(school.id, user.id) : null;

  const [cls, counts, rosters, tchs, absentRows] = await Promise.all([
    db.select({
      id: classes.id, name: classes.name, classTeacherId: classes.classTeacherId,
      formMasterId: classes.formMasterId,
      levelName: levels.name, sortOrder: levels.sortOrder,
    }).from(classes).innerJoin(levels, eq(classes.levelId, levels.id))
      .where(eq(classes.schoolId, school.id))
      .orderBy(asc(levels.sortOrder), asc(classes.name)),
    db.select({
      classId: attendanceRecords.classId,
      present: sql<number>`count(*) filter (where status = 'present')`,
      late: sql<number>`count(*) filter (where status = 'late')`,
      absent: sql<number>`count(*) filter (where status = 'absent')`,
      total: sql<number>`count(*)`,
      at: sql<Date>`max(created_at)`,
    }).from(attendanceRecords)
      .where(and(eq(attendanceRecords.schoolId, school.id), eq(attendanceRecords.date, today)))
      .groupBy(attendanceRecords.classId),
    db.select({ classId: students.classId, n: sql<number>`count(*)` }).from(students)
      .where(and(eq(students.schoolId, school.id), eq(students.status, "active")))
      .groupBy(students.classId),
    db.select({ id: staff.id, name: staff.name }).from(staff).where(eq(staff.schoolId, school.id)),
    // who is out today, by class — the names an office actually acts on
    db.select({ classId: attendanceRecords.classId, firstName: students.firstName, lastName: students.lastName })
      .from(attendanceRecords)
      .innerJoin(students, eq(attendanceRecords.studentId, students.id))
      .where(and(eq(attendanceRecords.schoolId, school.id), eq(attendanceRecords.date, today),
        eq(attendanceRecords.status, "absent"))),
  ]);
  const byClass = new Map(counts.map((c) => [c.classId, {
    present: Number(c.present), late: Number(c.late), absent: Number(c.absent),
    total: Number(c.total), at: c.at ? new Date(c.at) : null,
  }]));
  const rosterN = new Map(rosters.map((r) => [r.classId, Number(r.n)]));
  const teacherName = new Map(tchs.map((t) => [t.id, t.name]));
  const absentNames = new Map<string, string[]>();
  for (const r of absentRows) {
    if (!absentNames.has(r.classId)) absentNames.set(r.classId, []);
    absentNames.get(r.classId)!.push(`${r.firstName} ${r.lastName.charAt(0)}.`);
  }

  // ── teacher view ──
  if (isTeacher) {
    const homerooms = cls.filter((c) => scope?.homeroomIds.has(c.id));
    const subjectOnly = cls.filter((c) =>
      scope?.subjectClassIds.has(c.id) && !scope.homeroomIds.has(c.id));
    const allSubs = subjectOnly.length
      ? await db.select().from(subjects).where(eq(subjects.schoolId, school.id))
      : [];
    const subName = new Map(allSubs.map((s) => [s.id, s.name]));
    const subsOf = new Map<string, string[]>();
    for (const cell of scope?.cells ?? []) {
      if (!subjectOnly.some((c) => c.id === cell.classId)) continue;
      if (!subsOf.has(cell.classId)) subsOf.set(cell.classId, []);
      const n = subName.get(cell.subjectId);
      if (n) subsOf.get(cell.classId)!.push(n);
    }
    return (
      <div>
        <PageHeader title="Attendance" sub={dateLabel}
          action={{ href: "/attendance/register", label: "Record book" }} />
        {err && ERR[err] && (
          <p className="mb-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{ERR[err]}</p>
        )}
        <h2 className="mb-3 text-sm font-semibold">My register{homerooms.length === 1 ? "" : "s"}</h2>
        {homerooms.length === 0 && (
          <Empty title="You are not a class teacher"
            hint="Attendance is marked by the class teacher (form master). If that should be you, ask your admin to assign you on Teaching & allocations." />
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {homerooms.map((c) => {
            const m = byClass.get(c.id);
            const roster = rosterN.get(c.id) ?? 0;
            const out = absentNames.get(c.id) ?? [];
            return (
              <Link key={c.id} href={`/attendance/${c.id}`}>
                <Card className={m ? "border-success/40" : "border-warning/60"}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[15px] font-semibold">{c.name}</p>
                      <p className="text-[13px] text-muted-foreground" data-nums="">{roster} students</p>
                    </div>
                    {m
                      ? <span className="rounded-full bg-success/10 px-2 py-0.5 text-[12px] font-medium text-success" data-nums="">✓ {m.at ? hhmm(m.at) : "saved"}</span>
                      : <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[12px] font-medium text-warning">not marked</span>}
                  </div>
                  {m ? (
                    <div className="mt-3 space-y-1.5">
                      <RateBar {...m} />
                      <Breakdown {...m} />
                      {out.length > 0 && (
                        <p className="truncate text-[13px] text-danger">Out: {out.join(", ")}</p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm font-medium text-warning">Mark register →</p>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
        {subjectOnly.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-1 text-sm font-semibold text-muted-foreground">Classes you teach (subject only)</h2>
            <p className="mb-3 text-[13.5px] text-muted-foreground">
              Their registers are marked by each class teacher — you enter scores for your subjects under Assessment.
            </p>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {subjectOnly.map((c) => {
                const m = byClass.get(c.id);
                return (
                  <Card key={c.id} className="opacity-75">
                    <p className="font-medium">{c.name}</p>
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      {(subsOf.get(c.id) ?? []).join(", ") || "—"}
                    </p>
                    <p className="mt-1.5 text-[12.5px] text-faint">
                      Register: {teacherName.get(c.formMasterId ?? c.classTeacherId ?? "") ?? "no form master"}
                      {m && <span className="text-success"> · marked ✓</span>}
                    </p>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── admin monitoring board ──
  const withStudents = cls.filter((c) => (rosterN.get(c.id) ?? 0) > 0);
  const emptyClasses = cls.filter((c) => (rosterN.get(c.id) ?? 0) === 0);
  const unmarked = withStudents.filter((c) => !byClass.has(c.id));
  const marked = withStudents.filter((c) => byClass.has(c.id));
  const nudgedAt = unmarked.length ? await nudgesTodayByClass(school.id) : new Map<string, Date>();

  const totals = counts.reduce((a, c) => ({
    present: a.present + Number(c.present), late: a.late + Number(c.late),
    absent: a.absent + Number(c.absent), total: a.total + Number(c.total),
  }), { present: 0, late: 0, absent: 0, total: 0 });
  const enrolled = [...rosterN.values()].reduce((a, n) => a + n, 0);
  const pct = withStudents.length ? Math.round((marked.length / withStudents.length) * 100) : 0;
  const inRate = totals.total ? Math.round(((totals.present + totals.late) / totals.total) * 100) : null;

  return (
    <div>
      <PageHeader title="Attendance" sub={dateLabel}
        action={{ href: "/attendance/register", label: "Record book" }} />

      {err && ERR[err] && (
        <p className="mb-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{ERR[err]}</p>
      )}

      {/* today's pulse — can the office stop chasing yet? */}
      <Card className="mb-6">
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <div className="flex items-baseline justify-between">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Registers marked</p>
              <p className="text-sm font-semibold" data-nums="">{marked.length}/{withStudents.length}</p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-border/60">
              <div className={pct === 100 ? "h-full bg-success" : "h-full bg-primary"} style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              {pct === 100 ? "All registers in ✓" : `${unmarked.length} still to come in`}
            </p>
          </div>
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">In school</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight" data-nums="">
              {totals.total ? `${inRate}%` : "—"}
            </p>
            <p className="text-[13px] text-muted-foreground" data-nums="">
              {totals.total ? `${totals.present + totals.late} of ${totals.total} marked` : `${enrolled} enrolled`}
            </p>
          </div>
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Absent</p>
            <p className={`mt-1 text-2xl font-semibold tracking-tight ${totals.absent ? "text-danger" : ""}`} data-nums="">
              {totals.total ? totals.absent : "—"}
            </p>
            <p className="text-[13px] text-muted-foreground" data-nums="">
              {totals.late > 0 ? `plus ${totals.late} late` : totals.total ? "guardians alerted by SMS" : "no registers in yet"}
            </p>
          </div>
        </div>
      </Card>

      {unmarked.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold">
            Needs attention <span className="ml-1 rounded-full bg-warning/15 px-2 py-0.5 text-[12.5px] font-semibold text-warning" data-nums="">{unmarked.length}</span>
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {unmarked.map((c) => {
              const tname = teacherName.get(c.formMasterId ?? c.classTeacherId ?? "");
              const nudge = nudgedAt.get(c.id);
              return (
                <Card key={c.id} className="border-warning/60">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link href={`/attendance/${c.id}`} className="text-[15px] font-semibold hover:text-primary">{c.name}</Link>
                      <p className="text-[13px] text-muted-foreground" data-nums="">{rosterN.get(c.id)} students · {c.levelName}</p>
                    </div>
                    <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[12px] font-medium text-warning">not marked</span>
                  </div>
                  <p className="mt-2.5 text-[13.5px]">
                    {tname
                      ? <span className="text-muted-foreground">Class teacher: <span className="font-medium text-foreground">{tname}</span></span>
                      : <span className="font-medium text-warning">No class teacher assigned</span>}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
                    {tname ? (
                      <form action={remindClassTeacher.bind(null, slug, c.id)}>
                        <input type="hidden" name="from" value="wall" />
                        <SubmitButton className={btnCls + " px-3 py-1.5 text-[13.5px]"} pendingText="Sending…">
                          {nudge ? "Remind again" : "Send reminder"}
                        </SubmitButton>
                      </form>
                    ) : (
                      <Link href="/staff/allocations" className="text-[13.5px] font-medium text-primary">Assign teacher →</Link>
                    )}
                    <span className="text-[12.5px] text-faint" data-nums="">
                      {nudge ? `reminded ${hhmm(nudge)}` : ""}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {marked.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold">
            Marked <span className="ml-1 rounded-full bg-success/10 px-2 py-0.5 text-[12.5px] font-semibold text-success" data-nums="">{marked.length}</span>
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {marked.map((c) => {
              const m = byClass.get(c.id)!;
              const out = absentNames.get(c.id) ?? [];
              return (
                <Link key={c.id} href={`/attendance/${c.id}`}>
                  <Card className={m.absent > 0 ? "border-danger/30" : "border-success/40"}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[15px] font-semibold">{c.name}</p>
                        <p className="text-[13px] text-muted-foreground">
                          {teacherName.get(c.formMasterId ?? c.classTeacherId ?? "") ?? "no form master"}
                        </p>
                      </div>
                      <span className="rounded-full bg-success/10 px-2 py-0.5 text-[12px] font-medium text-success" data-nums="">
                        ✓ {m.at ? hhmm(m.at) : "saved"}
                      </span>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      <RateBar {...m} />
                      <Breakdown {...m} />
                      {out.length > 0 && (
                        <p className="truncate text-[13px] text-danger" title={out.join(", ")}>
                          Out: {out.slice(0, 3).join(", ")}{out.length > 3 ? ` +${out.length - 3}` : ""}
                        </p>
                      )}
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {withStudents.length === 0 && (
        <Empty title="No classes with students yet"
          hint="Once students are enrolled into classes, today's registers appear here." />
      )}

      {emptyClasses.length > 0 && (
        <p className="mt-6 text-[13px] text-faint">
          No students yet: {emptyClasses.map((c) => c.name).join(", ")} — these classes have no register to mark.
        </p>
      )}
    </div>
  );
}
