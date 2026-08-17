import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { assignments, classes, subjects, submissions, students } from "@/db/schema";
import { requireModule } from "@/core/school-context";
import { getStudentSelf } from "@/core/portal";
import { markSubmission } from "../../portal-actions";
import { Card, DataTable, PageHeader, Tr, Td } from "@/ui/kit";
import { SubmitHomework } from "./submit";
import { r2Enabled, presignDownload } from "@/lib/r2";

export default async function HomeworkDetail({ params }: {
  params: Promise<{ school: string; id: string }>;
}) {
  const { school: slug, id } = await params;
  const { school, user } = await requireModule(slug, "homework");
  const [a] = await db.select({
    id: assignments.id, title: assignments.title, instructions: assignments.instructions,
    dueDate: assignments.dueDate, classId: assignments.classId,
    className: classes.name, subject: subjects.name,
  }).from(assignments)
    .leftJoin(classes, eq(assignments.classId, classes.id))
    .leftJoin(subjects, eq(assignments.subjectId, subjects.id))
    .where(and(eq(assignments.id, id), eq(assignments.schoolId, school.id)));
  if (!a) notFound();

  // ── student view: instructions + submit ──
  if (user.role === "student") {
    const me = await getStudentSelf(school.id, user.id);
    if (!me || me.classId !== a.classId) notFound();
    const [mine] = await db.select().from(submissions)
      .where(and(eq(submissions.assignmentId, id), eq(submissions.studentId, me.id)));
    return (
      <div className="max-w-lg">
        <PageHeader title={a.title} sub={`${a.subject} · due ${a.dueDate}`} />
        {a.instructions && <Card className="mb-4 text-sm">{a.instructions}</Card>}
        {mine?.mark != null && (
          <Card className="mb-4">
            <p className="text-sm">Mark: <b>{mine.mark}</b>{mine.feedback && ` — ${mine.feedback}`}</p>
          </Card>
        )}
        <SubmitHomework slug={slug} assignmentId={id} uploadsEnabled={r2Enabled}
          existingNote={mine?.note ?? ""} submittedAt={mine?.submittedAt?.toISOString() ?? null} />
      </div>
    );
  }

  // ── teacher/admin view: submissions + marking ──
  const roster = await db.select({
    id: students.id, firstName: students.firstName, lastName: students.lastName,
  }).from(students).where(and(eq(students.schoolId, school.id),
    eq(students.classId, a.classId), eq(students.status, "active")))
    .orderBy(students.lastName);
  const subs = await db.select().from(submissions)
    .where(and(eq(submissions.assignmentId, id), eq(submissions.schoolId, school.id)));
  const byStudent = new Map(subs.map((s) => [s.studentId, s]));
  const fileLinks = new Map<string, string>();
  if (r2Enabled)
    for (const s of subs) if (s.fileUrl) fileLinks.set(s.studentId, await presignDownload(s.fileUrl));

  return (
    <div className="max-w-3xl">
      <PageHeader title={a.title}
        sub={`${a.className} · ${a.subject} · due ${a.dueDate} · ${subs.length}/${roster.length} submitted`} />
      {a.instructions && <Card className="mb-4 text-sm">{a.instructions}</Card>}
      <DataTable head={["Student", "Status", "Work", "Mark & feedback"]}>
        {roster.map((r) => {
          const s = byStudent.get(r.id);
          return (
            <Tr key={r.id}>
              <Td className="font-medium">{r.lastName}, {r.firstName}</Td>
              <Td>{s
                ? <span className="text-success">submitted {s.submittedAt.toISOString().slice(0, 10)}</span>
                : <span className="text-muted-foreground">missing</span>}</Td>
              <Td className="max-w-40 truncate text-xs">
                {s?.note}
                {fileLinks.has(r.id) && (
                  <a href={fileLinks.get(r.id)} className="ml-1 text-primary" target="_blank">file ↓</a>
                )}
              </Td>
              <Td>
                {s && (
                  <form action={markSubmission.bind(null, slug, id, r.id)} className="flex items-center gap-1">
                    <input name="mark" type="number" min={0} max={100} defaultValue={s.mark ?? ""}
                      className="w-16 rounded-md border border-border px-2 py-1 text-xs" />
                    <input name="feedback" defaultValue={s.feedback ?? ""} placeholder="feedback"
                      className="w-32 rounded-md border border-border px-2 py-1 text-xs" />
                    <button className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground">✓</button>
                  </form>
                )}
              </Td>
            </Tr>
          );
        })}
      </DataTable>
    </div>
  );
}
