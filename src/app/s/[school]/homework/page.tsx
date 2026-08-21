import { eq, and, desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { assignments, classes, subjects, submissions } from "@/db/schema";
import { requireModule } from "@/core/school-context";
import { getParentChildren } from "@/core/portal";
import { getHomeworkConfig } from "@/modules/homework/config";
import Link from "next/link";
import { createHomework, saveHomeworkConfig } from "./actions";
import { Card, DataTable, Field, PageHeader, Empty, Tr, Td, inputCls, btnCls } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";

export default async function Homework({ params }: { params: Promise<{ school: string }> }) {
  const { school: slug } = await params;
  const { school, user } = await requireModule(slug, "homework");
  const cfg = getHomeworkConfig(school.settings);

  // ── parent: each child's homework, with hand-in status if the school records it ──
  if (user.role === "parent") {
    const kids = await getParentChildren(school.id, user.id);
    const classIds = [...new Set(kids.map((k) => k.classId).filter(Boolean))] as string[];
    const rows = classIds.length
      ? await db.select({
          id: assignments.id, title: assignments.title, dueDate: assignments.dueDate,
          classId: assignments.classId, subject: subjects.name,
        }).from(assignments)
          .leftJoin(subjects, eq(assignments.subjectId, subjects.id))
          .where(and(eq(assignments.schoolId, school.id), inArray(assignments.classId, classIds)))
          .orderBy(desc(assignments.dueDate)).limit(20)
      : [];
    const subs = rows.length && cfg.recordSubmissions
      ? await db.select({ assignmentId: submissions.assignmentId, studentId: submissions.studentId })
          .from(submissions).where(inArray(submissions.assignmentId, rows.map((r) => r.id)))
      : [];
    const handedIn = new Set(subs.map((s) => `${s.assignmentId}:${s.studentId}`));
    const today = new Date().toISOString().slice(0, 10);

    return (
      <div className="max-w-2xl">
        <PageHeader title="Homework"
          sub="What has been set for your child — ask them about it at home" />
        {kids.filter((k) => k.classId).map((k) => (
          <Card key={k.id} className="mb-4">
            <h2 className="font-semibold">{k.firstName} {k.lastName}
              <span className="ml-2 text-[12px] font-normal text-muted-foreground">{k.className}</span></h2>
            <ul className="mt-2 divide-y divide-border text-sm">
              {rows.filter((r) => r.classId === k.classId).slice(0, 8).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="min-w-0">
                    <span className="font-medium">{r.title}</span>
                    <span className="ml-2 text-[12px] text-muted-foreground">{r.subject} · due {r.dueDate}</span>
                  </span>
                  {cfg.recordSubmissions && (
                    handedIn.has(`${r.id}:${k.id}`)
                      ? <span className="shrink-0 text-[12px] font-medium text-success">handed in ✓</span>
                      : <span className={`shrink-0 text-[12px] ${r.dueDate < today ? "text-danger" : "text-muted-foreground"}`}>
                          {r.dueDate < today ? "not handed in" : "pending"}
                        </span>
                  )}
                </li>
              ))}
              {rows.filter((r) => r.classId === k.classId).length === 0 && (
                <li className="py-1.5 text-muted-foreground">No homework set recently.</li>
              )}
            </ul>
          </Card>
        ))}
        {kids.length === 0 && <Empty title="No children linked" hint="Please contact the school office." />}
      </div>
    );
  }
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
      {["admin", "platform_admin"].includes(user.role) && (
        <Card className="mt-5">
          <h2 className="font-semibold">What this school records</h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Homework here is a record, not done in-app. Choose how much to track — marks
            recorded twice (books AND the app) can be a pain, so that&apos;s off unless you want it.
          </p>
          <form action={saveHomeworkConfig.bind(null, slug)} className="mt-3 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-1.5 text-[13px]">
              <input type="checkbox" name="recordSubmissions" defaultChecked={cfg.recordSubmissions} />
              Record hand-ins (parents see who submitted)
            </label>
            <label className="flex items-center gap-1.5 text-[13px]">
              <input type="checkbox" name="recordMarks" defaultChecked={cfg.recordMarks} />
              Also record marks &amp; feedback in-app
            </label>
            <SubmitButton className={btnCls} pendingText="Saving…">Save</SubmitButton>
          </form>
        </Card>
      )}
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
            <SubmitButton className={btnCls + " col-span-2"}>Assign</SubmitButton>
          </form>
        </Card>
      )}
    </div>
  );
}
