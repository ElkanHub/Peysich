import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { componentScores, scoreSheets, scorePublications, gradingSchemes, students } from "@/db/schema";
import { requireModule, getCurrentTerm, getTeacherScope } from "@/core/school-context";
import { getStructure } from "@/core/academics";
import { Card, PageHeader, Badge, btnCls, btnGhostCls } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";
import { saveSheet, submitSheetColumn } from "../../actions";

const ERR: Record<string, string> = {
  closed: "This term is closed — scores can no longer change.",
};
const DEFAULT_BANDS = [
  { min: 80, grade: "1", remark: "Excellent" }, { min: 70, grade: "2", remark: "Very Good" },
  { min: 60, grade: "3", remark: "Good" }, { min: 55, grade: "4", remark: "Credit" },
  { min: 50, grade: "5", remark: "Average" }, { min: 40, grade: "6", remark: "Below Average" },
  { min: 35, grade: "7", remark: "Pass" }, { min: 30, grade: "8", remark: "Weak Pass" },
  { min: 0, grade: "9", remark: "Fail" },
];

/** The score sheet as ONE table: students down the side, every configured
 *  test across the top, the exam last, live totals at the end. Teachers
 *  enter raw marks over whatever they marked out of; submission locks a
 *  column for them; admin adjustments hide behind ⋯. */
export default async function ScorePage({ params, searchParams }: {
  params: Promise<{ school: string; classId: string; subjectId: string }>;
  searchParams: Promise<{ err?: string; unlock?: string }>;
}) {
  const { school: slug, classId, subjectId } = await params;
  const sp = await searchParams;
  const { school, user } = await requireModule(slug, "assessment", ["admin", "teacher"]);
  const isTeacher = user.role === "teacher";
  if (isTeacher) {
    const scope = await getTeacherScope(school.id, user.id);
    if (!scope?.canScore(classId, subjectId)) notFound();
  }
  const term = await getCurrentTerm(school.id);
  const S = await getStructure(school.id);
  const cls = S.classById.get(classId);
  const sub = S.subjectById.get(subjectId);
  if (!cls || !sub || !term) notFound();
  const section = S.sectionOfClass(cls);
  if (S.levelById.get(cls.levelId)?.preschool) redirect(`/assessment/skills/${classId}`);
  const comps = S.componentsFor(section);

  const [roster, sheets, marks, pubs, [scheme]] = await Promise.all([
    db.select({ id: students.id, firstName: students.firstName, lastName: students.lastName })
      .from(students).where(and(eq(students.schoolId, school.id),
        eq(students.classId, classId), eq(students.status, "active")))
      .orderBy(students.lastName),
    db.select().from(scoreSheets).where(and(eq(scoreSheets.termId, term.id),
      eq(scoreSheets.classId, classId), eq(scoreSheets.subjectId, subjectId))),
    db.select().from(componentScores).where(and(eq(componentScores.termId, term.id),
      eq(componentScores.classId, classId), eq(componentScores.subjectId, subjectId))),
    db.select().from(scorePublications).where(and(
      eq(scorePublications.schoolId, school.id), eq(scorePublications.termId, term.id))),
    db.select().from(gradingSchemes).where(eq(gradingSchemes.schoolId, school.id)),
  ]);
  const sheetBy = new Map(sheets.map((s) => [s.componentId, s]));
  const rawBy = new Map(marks.map((m) => [`${m.componentId}_${m.studentId}`, m.raw]));
  const published = new Set(pubs.map((p) => p.componentId));
  const bands = scheme?.bands ?? DEFAULT_BANDS;
  const unlock = sp.unlock === "1" && !isTeacher;
  const locked = term.scoresLocked;
  const anySubmitted = comps.some((c) => sheetBy.get(c.id)?.submitted);

  const editable = (compId: string) => {
    if (locked) return false;
    const submitted = sheetBy.get(compId)?.submitted ?? false;
    return isTeacher ? !submitted : (!submitted || unlock);
  };
  const converted = (compId: string, studentId: string) => {
    const raw = rawBy.get(`${compId}_${studentId}`);
    if (raw === undefined) return null;
    const outOf = sheetBy.get(compId)?.outOf ?? 100;
    const w = comps.find((c) => c.id === compId)?.weight ?? 0;
    return (raw / outOf) * w;
  };

  return (
    <div>
      <PageHeader title={`${cls.name} · ${sub.name}`}
        sub={`${term.name} · ${roster.length} students · scheme: ${comps.map((c) => `${c.name} /${c.weight}`).join(" + ")} = 100`} />

      {sp.err && ERR[sp.err] && (
        <p className="mb-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{ERR[sp.err]}</p>
      )}
      {unlock && (
        <p className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning/50 bg-warning-soft px-3 py-2 text-sm">
          <span>You are adjusting <b>submitted</b> columns — changes are recorded under your name.</span>
          <Link href={`/assessment/${classId}/${subjectId}`} className="font-medium text-primary">Done adjusting</Link>
        </p>
      )}

      <form action={saveSheet.bind(null, slug, classId, subjectId)}>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-muted/60 text-left">
                <th className="border-b border-r border-border px-3 py-2 font-semibold">Student</th>
                {comps.map((c) => {
                  const sheet = sheetBy.get(c.id);
                  return (
                    <th key={c.id} className={`border-b border-border px-2 py-2 text-center font-medium ${c.isExam ? "border-l bg-brand-soft/40" : ""}`}>
                      <div>{c.name}</div>
                      <div className="mt-0.5 flex items-center justify-center gap-1 text-[10.5px] font-normal text-muted-foreground">
                        <span>marked over</span>
                        {editable(c.id)
                          ? <input name={`outOf_${c.id}`} type="number" min={1} defaultValue={sheet?.outOf ?? 100}
                              className="w-14 rounded border border-border bg-card px-1 py-0.5 text-center" data-nums="" />
                          : <b data-nums="">{sheet?.outOf ?? 100}</b>}
                        <span data-nums="">→ /{c.weight}</span>
                      </div>
                      <div className="mt-1">
                        {sheet?.submitted
                          ? published.has(c.id)
                            ? <Badge tone="success">published ✓</Badge>
                            : <Badge tone="brand">submitted ✓</Badge>
                          : <Badge tone="default">draft</Badge>}
                      </div>
                    </th>
                  );
                })}
                <th className="border-b border-l border-border px-2 py-2 text-center font-semibold">Total /100</th>
                <th className="border-b border-border px-2 py-2 text-center font-semibold">Grade</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((r) => {
                const parts = comps.map((c) => converted(c.id, r.id));
                const hasAny = parts.some((p) => p !== null);
                const total = parts.reduce<number>((a, p) => a + (p ?? 0), 0);
                const band = bands.find((b) => total >= b.min) ?? bands.at(-1)!;
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="border-r border-border px-3 py-1.5 font-medium">{r.lastName}, {r.firstName}</td>
                    {comps.map((c) => {
                      const raw = rawBy.get(`${c.id}_${r.id}`);
                      return (
                        <td key={c.id} className={`px-1.5 py-1 text-center ${c.isExam ? "border-l border-border bg-brand-soft/20" : ""}`}>
                          {editable(c.id)
                            ? <input name={`sc_${c.id}_${r.id}`} type="number" min={0} step="0.5"
                                defaultValue={raw ?? ""} placeholder="–"
                                className="w-16 rounded border border-border bg-card px-1 py-1 text-center" data-nums="" />
                            : <span data-nums="">{raw ?? "–"}</span>}
                        </td>
                      );
                    })}
                    <td className="border-l border-border px-2 py-1.5 text-center font-semibold" data-nums="">
                      {hasAny ? Math.round(total * 10) / 10 : "–"}
                    </td>
                    <td className="px-2 py-1.5 text-center" data-nums="">{hasAny ? band.grade : "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!locked && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <SubmitButton className={btnCls} pendingText="Saving…">Save draft</SubmitButton>
            {comps.filter((c) => !(sheetBy.get(c.id)?.submitted)).map((c) => (
              <SubmitButton key={c.id}
                formAction={submitSheetColumn.bind(null, slug, classId, subjectId, c.id)}
                className={btnGhostCls} pendingText="Submitting…">
                Submit {c.name} 🔒
              </SubmitButton>
            ))}
          </div>
        )}
        <p className="mt-2 text-[12px] text-muted-foreground">
          Totals convert each raw mark to its weight (raw ÷ marked-over × weight) and update when you save.
          Submitting a column locks it{isTeacher ? " — ask your admin if something must change after that." : "."}
        </p>

        {!isTeacher && anySubmitted && !unlock && !locked && (
          <details className="mt-4">
            <summary className={btnGhostCls + " inline-flex cursor-pointer list-none"}>⋯ More</summary>
            <div className="mt-2 rounded-lg border border-border p-3 text-sm">
              <p className="text-muted-foreground">
                <b>Adjust submitted scores</b> — for corrections after a teacher has submitted.
              </p>
              <Link href={`/assessment/${classId}/${subjectId}?unlock=1`} className={btnCls + " mt-2 inline-block"}>
                Unlock submitted columns
              </Link>
            </div>
          </details>
        )}
      </form>
    </div>
  );
}
