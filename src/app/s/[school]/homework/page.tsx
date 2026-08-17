import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { assignments, classes, subjects, submissions } from "@/db/schema";
import { requireModule } from "@/core/school-context";
import Link from "next/link";
import { createHomework } from "./actions";
import { Card, DataTable, Field, PageHeader, Tr, Td, inputCls, btnCls } from "@/ui/kit";

export default async function Homework({ params }: { params: Promise<{ school: string }> }) {
  const { school: slug } = await params;
  const { school, user } = await requireModule(slug, "homework");
  const [rows, cls, subs] = await Promise.all([
    db.select({
      id: assignments.id, title: assignments.title, dueDate: assignments.dueDate,
      className: classes.name, subject: subjects.name,
    }).from(assignments)
      .leftJoin(classes, eq(assignments.classId, classes.id))
      .leftJoin(subjects, eq(assignments.subjectId, subjects.id))
      .where(eq(assignments.schoolId, school.id))
      .orderBy(desc(assignments.dueDate)).limit(30),
    db.select().from(classes).where(eq(classes.schoolId, school.id)),
    db.select().from(subjects).where(eq(subjects.schoolId, school.id)),
  ]);
  const counts = await Promise.all(rows.map(async (r) => {
    const s = await db.select().from(submissions)
      .where(and(eq(submissions.assignmentId, r.id), eq(submissions.schoolId, school.id)));
    return s.length;
  }));
  const canCreate = ["admin", "teacher", "platform_admin"].includes(user.role);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Homework" sub={`${rows.length} recent assignments`} />
      <DataTable head={["Title", "Class", "Subject", "Due", "Submissions"]}>
        {rows.map((r, i) => (
          <Tr key={r.id}>
            <Td className="font-medium"><Link href={`/homework/${r.id}`} className="text-primary underline-offset-2 hover:underline">{r.title}</Link></Td>
            <Td>{r.className}</Td><Td>{r.subject}</Td>
            <Td>{r.dueDate}</Td><Td>{counts[i]}</Td>
          </Tr>
        ))}
      </DataTable>
      {canCreate && (
        <Card className="mt-5">
          <h2 className="font-semibold">Set homework</h2>
          <form action={createHomework.bind(null, slug)} className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Title"><input name="title" required className={inputCls} /></Field>
            <Field label="Due date"><input name="dueDate" type="date" required className={inputCls} /></Field>
            <Field label="Class">
              <select name="classId" className={inputCls}>{cls.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </Field>
            <Field label="Subject">
              <select name="subjectId" className={inputCls}>{subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            </Field>
            <div className="col-span-2">
              <Field label="Instructions"><textarea name="instructions" rows={3} className={inputCls} /></Field>
            </div>
            <button className={btnCls + " col-span-2"}>Assign</button>
          </form>
        </Card>
      )}
    </div>
  );
}
