import Link from "next/link";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { levels, students, scoreSheets, componentScores } from "@/db/schema";
import { requireModule, getCurrentTerm, getTeacherScope } from "@/core/school-context";
import { getStructure } from "@/core/academics";
import { PerformanceTable } from "@/modules/assessment/performance-table";
import { Card, PageHeader, Empty } from "@/ui/kit";

/** Assessment home. Teachers: their classes → subject sheets (entry).
 *  Admin: everything revolves around the STUDENT — a Students view (class →
 *  child → their whole record, the exact report a parent would get) and a
 *  Subjects view (which teachers have submitted what), plus completeness-
 *  aware publishing. */
export default async function Assessment({ params, searchParams }: {
  params: Promise<{ school: string }>;
  searchParams: Promise<{ view?: string; c?: string; stu?: string }>;
}) {
  const { school: slug } = await params;
  const sp = await searchParams;
  const { school, user } = await requireModule(slug, "assessment", ["admin", "teacher"]);
  const scope = user.role === "teacher" ? await getTeacherScope(school.id, user.id) : undefined;
  const term = await getCurrentTerm(school.id);
  const S = await getStructure(school.id);
  const lvs = await db.select().from(levels).where(eq(levels.schoolId, school.id));
  const preschool = new Set(lvs.filter((l) => l.preschool).map((l) => l.id));
  const byLevel = (a: typeof S.classes[number], b: typeof S.classes[number]) =>
    (S.levelById.get(a.levelId)?.sortOrder ?? 0) - (S.levelById.get(b.levelId)?.sortOrder ?? 0)
    || a.name.localeCompare(b.name);

  /* ── TEACHER: entry sheets for their classes, unchanged flow ── */
  if (scope !== undefined) {
    const cls = S.classes.filter((c) => scope?.allClassIds.has(c.id)).sort(byLevel);
    const subjectsFor = (classId: string) => {
      const eff = S.effectiveSubjectIds(classId)
        .map((id) => S.subjectById.get(id)!).filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name));
      return scope!.homeroomIds.has(classId)
        ? eff
        : eff.filter((su) => scope!.cells.some((ce) => ce.classId === classId && ce.subjectId === su.id));
    };
    return (
      <div>
        <PageHeader title="Assessment"
          sub={term ? `${term.name}${term.scoresLocked ? " · closed" : ""}` : "No current term"} />
        <div className="space-y-4">
          {cls.map((c) => (
            <Card key={c.id}>
              <p className="font-medium">{c.name}
                {preschool.has(c.levelId) && <span className="ml-2 text-xs text-muted-foreground">preschool · skills-based</span>}
                {!scope?.homeroomIds.has(c.id) && <span className="ml-2 text-xs text-muted-foreground">subject teacher</span>}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {preschool.has(c.levelId) ? (
                  scope?.homeroomIds.has(c.id) ? (
                    <Link href={`/assessment/skills/${c.id}`}
                      className="rounded-md border border-primary px-3 py-1.5 text-sm text-primary hover:bg-muted">
                      Skills assessment grid
                    </Link>
                  ) : <span className="text-xs text-muted-foreground">Skills grid is the class teacher&apos;s</span>
                ) : subjectsFor(c.id).map((s) => (
                  <Link key={s.id} href={`/assessment/${c.id}/${s.id}`}
                    className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
                    {s.name}
                  </Link>
                ))}
              </div>
            </Card>
          ))}
          {cls.length === 0 && <Empty title="No classes assigned"
            hint="Ask your admin to assign you on Teaching & allocations." />}
        </div>
      </div>
    );
  }

  /* ── ADMIN ── */
  if (!term) return <div><PageHeader title="Assessment" sub="No current term" />
    <Empty title="Set up your academic year first" hint="Settings → Academic year & terms." /></div>;

  const view = sp.view === "subjects" ? "subjects" : "students";
  const testClasses = S.classes.filter((c) => !preschool.has(c.levelId)).sort(byLevel);
  const preClasses = S.classes.filter((c) => preschool.has(c.levelId)).sort(byLevel);
  const activeClass = testClasses.find((c) => c.id === sp.c) ?? testClasses[0];

  const [sheets, rosterCounts] = await Promise.all([
    db.select().from(scoreSheets).where(and(
      eq(scoreSheets.schoolId, school.id), eq(scoreSheets.termId, term.id))),
    db.select({ classId: students.classId, n: sql<number>`count(*)` }).from(students)
      .where(and(eq(students.schoolId, school.id), eq(students.status, "active")))
      .groupBy(students.classId),
  ]);
  const submittedBy = new Set(sheets.filter((s) => s.submitted)
    .map((s) => `${s.classId}:${s.subjectId}:${s.componentId}`));
  const sheetBy = new Map(sheets.map((s) => [`${s.classId}:${s.subjectId}:${s.componentId}`, s]));
  const rosterN = new Map(rosterCounts.map((r) => [r.classId, Number(r.n)]));

  return (
    <div>
      <PageHeader title="Assessment"
        sub={`${term.name}${term.scoresLocked ? " · closed" : ""} · everything here revolves around the student`} />

      {/* releasing to families lives on Reports — this page is for the marks */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-[13px]">
        <span className="text-muted-foreground">
          Releasing results to families — per test, with readiness — happens on the <b className="text-foreground">Reports</b> tab.
        </span>
        <span className="flex gap-3 font-medium">
          <Link href="/reports" className="text-primary">Open Reports →</Link>
          <Link href="/settings/assessment" className="text-primary">Configure the scheme →</Link>
        </span>
      </div>

      {/* ── view tabs ── */}
      <div className="mb-4 flex gap-2">
        {(["students", "subjects"] as const).map((v) => (
          <Link key={v} href={`?view=${v}${activeClass ? `&c=${activeClass.id}` : ""}`}
            className={`rounded-md border px-3.5 py-1.5 text-sm font-medium capitalize ${v === view
              ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}>
            By {v}
          </Link>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {testClasses.map((c) => (
          <Link key={c.id} href={`?view=${view}&c=${c.id}`}
            className={`rounded-md border px-2.5 py-1 text-[12.5px] font-medium ${c.id === activeClass?.id
              ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}>
            {c.name}
          </Link>
        ))}
      </div>

      {!activeClass ? (
        <Empty title="No classes yet" hint="Create your structure under Settings first." />
      ) : view === "students" ? (
        <StudentsView schoolId={school.id} slug={slug} termId={term.id}
          S={S} classId={activeClass.id} openStudentId={sp.stu} submittedBy={submittedBy} />
      ) : (
        <SubjectsView S={S} classId={activeClass.id} termId={term.id}
          sheetBy={sheetBy} rosterN={rosterN.get(activeClass.id) ?? 0} schoolId={school.id} />
      )}

      {preClasses.length > 0 && (
        <Card className="mt-6">
          <h2 className="font-semibold">Preschool (skills-based)</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {preClasses.map((c) => (
              <Link key={c.id} href={`/assessment/skills/${c.id}`}
                className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
                {c.name} — skills grid
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ── Students view: the class roster, each child's completeness, and the
 *    full record inline — exactly what the parent will receive. ── */
async function StudentsView({ schoolId, slug, termId, S, classId, openStudentId, submittedBy }: {
  schoolId: string; slug: string; termId: string;
  S: Awaited<ReturnType<typeof getStructure>>; classId: string;
  openStudentId?: string; submittedBy: Set<string>;
}) {
  const cls = S.classById.get(classId)!;
  const comps = S.componentsFor(S.sectionOfClass(cls));
  const subjectIds = S.effectiveSubjectIds(classId);
  const [roster, marks] = await Promise.all([
    db.select({ id: students.id, firstName: students.firstName, lastName: students.lastName })
      .from(students).where(and(eq(students.schoolId, schoolId),
        eq(students.classId, classId), eq(students.status, "active")))
      .orderBy(students.lastName),
    db.select({
      studentId: componentScores.studentId, componentId: componentScores.componentId,
      n: sql<number>`count(*)`,
    }).from(componentScores)
      .where(and(eq(componentScores.termId, termId), eq(componentScores.classId, classId)))
      .groupBy(componentScores.studentId, componentScores.componentId),
  ]);
  const countBy = new Map(marks.map((m) => [`${m.studentId}:${m.componentId}`, Number(m.n)]));
  const open = roster.find((r) => r.id === openStudentId);

  return (
    <Card>
      <p className="text-[12.5px] text-muted-foreground">
        {roster.length} students · each chip shows how many of the {subjectIds.length} subjects
        have a mark in for that test. Open a child to see the exact record their family receives.
      </p>
      <ul className="mt-3 divide-y divide-border">
        {roster.map((r) => (
          <li key={r.id} className="py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`?view=students&c=${classId}&stu=${r.id}`}
                className={`font-medium ${open?.id === r.id ? "text-primary" : "hover:text-primary"}`}>
                {r.lastName}, {r.firstName}
              </Link>
              <span className="flex flex-wrap items-center gap-1.5">
                {comps.map((c) => {
                  const n = countBy.get(`${r.id}:${c.id}`) ?? 0;
                  const full = n >= subjectIds.length && subjectIds.length > 0;
                  return (
                    <span key={c.id} data-nums=""
                      className={`rounded-full px-2 py-0.5 text-[10.5px] font-medium ${full
                        ? "bg-success/10 text-success" : n > 0 ? "bg-warning/15 text-warning" : "bg-muted text-faint"}`}>
                      {c.name.split(" ").map((w) => w[0]).join("")} {n}/{subjectIds.length}
                    </span>
                  );
                })}
              </span>
            </div>
            {open?.id === r.id && (
              <div className="mt-2 rounded-lg border border-primary/30 p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[12.5px] font-semibold">{r.firstName}&apos;s full record — as the family sees it</p>
                  <span className="flex gap-3 text-[12.5px] font-medium">
                    <Link href={`/students/${r.id}/performance/${termId}`} className="text-primary">Printable preview →</Link>
                    <Link href={`/students/${r.id}?tab=performance`} className="text-primary">Student file →</Link>
                    <Link href={`?view=students&c=${classId}`} className="text-muted-foreground">Close</Link>
                  </span>
                </div>
                <PerformanceTable schoolId={schoolId} studentId={r.id} classId={classId} termId={termId} />
              </div>
            )}
          </li>
        ))}
        {roster.length === 0 && <li className="py-2 text-sm text-muted-foreground">No active students in this class.</li>}
      </ul>
    </Card>
  );
}

/* ── Subjects view: has every teacher submitted? subject × test grid. ── */
async function SubjectsView({ S, classId, termId, sheetBy, rosterN, schoolId }: {
  S: Awaited<ReturnType<typeof getStructure>>; classId: string; termId: string;
  sheetBy: Map<string, { submitted: boolean }>; rosterN: number; schoolId: string;
}) {
  const cls = S.classById.get(classId)!;
  const comps = S.componentsFor(S.sectionOfClass(cls));
  const subjectIds = S.effectiveSubjectIds(classId);
  const counts = await db.select({
    subjectId: componentScores.subjectId, componentId: componentScores.componentId,
    n: sql<number>`count(*)`,
  }).from(componentScores)
    .where(and(eq(componentScores.termId, termId), eq(componentScores.classId, classId)))
    .groupBy(componentScores.subjectId, componentScores.componentId);
  const nBy = new Map(counts.map((c) => [`${c.subjectId}:${c.componentId}`, Number(c.n)]));

  return (
    <Card>
      <p className="text-[12.5px] text-muted-foreground">
        Submission status per subject — <span className="text-success">green = submitted (locked)</span>,{" "}
        <span className="text-warning">amber = marks entered, not yet submitted</span>, grey = nothing yet.
        Click any cell to open that sheet. Teacher per subject is on{" "}
        <Link href="/staff/allocations" className="font-medium text-primary">Teaching &amp; allocations</Link>.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="py-1.5 pr-2">Subject</th>
              {comps.map((c) => <th key={c.id} className="px-2 py-1.5 text-center">{c.name}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {subjectIds
              .map((sid) => S.subjectById.get(sid)!).filter(Boolean)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((sub) => {
                const tid = S.teacherFor(classId, sub.id);
                return (
                  <tr key={sub.id}>
                    <td className="py-1.5 pr-2">
                      <span className="font-medium">{sub.name}</span>
                      <span className="ml-2 text-[11px] text-muted-foreground">
                        {tid ? S.staffById.get(tid)?.name : "no teacher"}
                      </span>
                    </td>
                    {comps.map((c) => {
                      const submitted = sheetBy.get(`${classId}:${sub.id}:${c.id}`)?.submitted ?? false;
                      const n = nBy.get(`${sub.id}:${c.id}`) ?? 0;
                      return (
                        <td key={c.id} className="px-2 py-1 text-center">
                          <Link href={`/assessment/${classId}/${sub.id}`} data-nums=""
                            className={`inline-block min-w-16 rounded-md px-2 py-1 text-[11.5px] font-medium ${submitted
                              ? "bg-success/10 text-success" : n > 0
                                ? "bg-warning/15 text-warning" : "bg-muted text-faint hover:text-muted-foreground"}`}>
                            {submitted ? "✓ submitted" : n > 0 ? `${n}/${rosterN} entered` : "—"}
                          </Link>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
