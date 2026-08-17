import { and, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { assessments, classes, subjects, students, scores } from "@/db/schema";
import { requireModule, getCurrentTerm } from "@/core/school-context";
import { createAssessment } from "../../actions";
import { Card, Field, PageHeader, btnCls, inputCls } from "@/ui/kit";
import { ScoreSheet } from "./sheet";

export default async function ScorePage({ params, searchParams }: {
  params: Promise<{ school: string; classId: string; subjectId: string }>;
  searchParams: Promise<{ a?: string }>;
}) {
  const { school: slug, classId, subjectId } = await params;
  const { a: activeId } = await searchParams;
  const { school } = await requireModule(slug, "assessment", ["admin", "teacher"]);
  const term = await getCurrentTerm(school.id);
  const [[cls], [sub]] = await Promise.all([
    db.select().from(classes).where(and(eq(classes.id, classId), eq(classes.schoolId, school.id))),
    db.select().from(subjects).where(and(eq(subjects.id, subjectId), eq(subjects.schoolId, school.id))),
  ]);
  if (!cls || !sub || !term) notFound();

  const list = await db.select().from(assessments).where(and(
    eq(assessments.schoolId, school.id), eq(assessments.termId, term.id),
    eq(assessments.classId, classId), eq(assessments.subjectId, subjectId)));
  const active = list.find((a) => a.id === activeId) ?? list[0];
  const roster = await db.select({
    id: students.id, firstName: students.firstName, lastName: students.lastName,
  }).from(students).where(and(eq(students.schoolId, school.id),
    eq(students.classId, classId), eq(students.status, "active")))
    .orderBy(students.lastName);
  const existing = active
    ? await db.select().from(scores).where(and(
        eq(scores.assessmentId, active.id),
        inArray(scores.studentId, roster.map((r) => r.id).concat("-"))))
    : [];

  return (
    <div className="max-w-2xl">
      <PageHeader title={`${cls.name} · ${sub.name}`} sub={`${term.name} · ${roster.length} students`} />
      <div className="mb-4 flex flex-wrap gap-2">
        {list.map((a) => (
          <a key={a.id} href={`?a=${a.id}`}
            className={`rounded-md border px-3 py-1.5 text-sm ${a.id === active?.id ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}>
            {a.title} <span className="opacity-70">/{a.maxScore}</span>
          </a>
        ))}
      </div>
      {!term.scoresLocked && (
        <Card className="mb-4">
          <form action={createAssessment.bind(null, slug, classId, subjectId)} className="flex items-end gap-2">
            <Field label="Title"><input name="title" placeholder="CA 1" required className={inputCls} /></Field>
            <Field label="Type">
              <select name="kind" className={inputCls}><option value="ca">CA</option><option value="exam">Exam</option></select>
            </Field>
            <Field label="Max"><input name="maxScore" type="number" defaultValue={100} className={inputCls + " w-20"} /></Field>
            <button className={btnCls}>Add</button>
          </form>
        </Card>
      )}
      {active ? (
        <ScoreSheet slug={slug} assessmentId={active.id} maxScore={active.maxScore}
          locked={term.scoresLocked} roster={roster}
          initial={Object.fromEntries(existing.map((s) => [s.studentId, s.score]))} />
      ) : (
        <p className="text-sm text-muted-foreground">Create the first assessment (e.g. CA 1) to start entering scores.</p>
      )}
    </div>
  );
}
