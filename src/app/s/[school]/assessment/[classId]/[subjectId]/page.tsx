import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { componentScores, scoreSheets, scorePublications, gradingSchemes, students } from "@/db/schema";
import { requireModule, getCurrentTerm, getTeacherScope } from "@/core/school-context";
import { getStructure } from "@/core/academics";
import { PageHeader } from "@/ui/kit";
import { Sheet, UnlockDisclosure, type SheetComp } from "./sheet";

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

/** One class × subject score sheet — students down the side, every configured
 *  test + the exam across the top. Marking, conversion and totals live in the
 *  interactive Sheet; this page just gathers the data and enforces rights. */
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
  if (S.levelById.get(cls.levelId)?.preschool) redirect(`/assessment/skills/${classId}`);
  const comps = S.componentsFor(S.sectionOfClass(cls));

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
  const published = new Set(pubs.map((p) => p.componentId));
  const unlock = sp.unlock === "1" && !isTeacher;
  const locked = term.scoresLocked;

  const sheetComps: SheetComp[] = comps.map((c) => {
    const sheet = sheetBy.get(c.id);
    const submitted = sheet?.submitted ?? false;
    return {
      id: c.id, name: c.name, weight: c.weight, isExam: c.isExam,
      outOf: sheet?.outOf ?? 100, submitted, published: published.has(c.id),
      editable: !locked && (isTeacher ? !submitted : (!submitted || unlock)),
    };
  });
  const initial = Object.fromEntries(
    marks.map((m) => [`${m.componentId}_${m.studentId}`, { raw: m.raw, absent: m.absent }]));
  const anySubmitted = sheetComps.some((c) => c.submitted);

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

      <Sheet slug={slug} classId={classId} subjectId={subjectId} roster={roster}
        comps={sheetComps} initial={initial} bands={scheme?.bands ?? DEFAULT_BANDS}
        isTeacher={isTeacher} />

      {!isTeacher && anySubmitted && !unlock && !locked && (
        <UnlockDisclosure href={`/assessment/${classId}/${subjectId}?unlock=1`} />
      )}
    </div>
  );
}
