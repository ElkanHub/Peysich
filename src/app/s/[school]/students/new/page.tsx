import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { students, classes, guardians, studentGuardians } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { Card, Field, PageHeader, inputCls, btnCls, btnGhostCls } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";
import { admitStudent } from "./actions";

/** ADD A STUDENT — one screen, five things, one Save. Everything else lives
 *  under "Add more details" on the child's page once they exist.
 *  `?draft=` is a child the Admissions module already pre-filled. */
export default async function AddStudent({ params, searchParams }: {
  params: Promise<{ school: string }>;
  searchParams: Promise<{ draft?: string }>;
}) {
  const { school: slug } = await params;
  const { draft } = await searchParams;
  const { school } = await requireSchool(slug, ["admin"]);
  const s = draft
    ? (await db.select().from(students)
        .where(and(eq(students.id, draft), eq(students.schoolId, school.id))))[0]
    : null;
  const [cls, parent] = await Promise.all([
    db.select().from(classes).where(eq(classes.schoolId, school.id)).orderBy(classes.name),
    s ? db.select({ name: guardians.name, phone: guardians.phone, relation: guardians.relation })
        .from(studentGuardians).innerJoin(guardians, eq(studentGuardians.guardianId, guardians.id))
        .where(eq(studentGuardians.studentId, s.id)).limit(1).then((r) => r[0] ?? null)
      : null,
  ]);

  return (
    <div className="max-w-xl">
      <PageHeader title="Add a student" sub="Five things and you are done. Everything else can wait." />
      <Card>
        <form action={admitStudent.bind(null, slug, s?.id ?? null)} className="grid gap-4 sm:grid-cols-2">
          <Field label="First name"><input name="firstName" required autoFocus defaultValue={s?.firstName} className={inputCls} /></Field>
          <Field label="Last name"><input name="lastName" required defaultValue={s?.lastName} className={inputCls} /></Field>
          <Field label="Boy or girl">
            <select name="sex" required defaultValue={s?.sex ?? ""} className={inputCls}>
              <option value="">Choose…</option>
              <option value="male">Boy</option>
              <option value="female">Girl</option>
            </select>
          </Field>
          <Field label="Class">
            <select name="classId" required defaultValue={s?.classId ?? ""} className={inputCls}>
              <option value="">Choose…</option>
              {cls.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <div className="grid gap-4 sm:col-span-2 sm:grid-cols-[1fr_1fr_auto]">
            <Field label="Parent's name"><input name="parentName" required defaultValue={parent?.name} className={inputCls} /></Field>
            <Field label="Parent's phone"><input name="parentPhone" required type="tel" placeholder="024 XXX XXXX" defaultValue={parent?.phone} className={inputCls} /></Field>
            <Field label="Who">
              <select name="relation" defaultValue={parent?.relation ?? "parent"} className={inputCls}>
                {["parent", "mother", "father", "grandparent", "aunt", "uncle", "sibling", "other"]
                  .map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
          </div>
          <p className="text-[13.5px] text-muted-foreground sm:col-span-2">
            All five are required. A phone already on file means a sibling’s parent — they are reused, not duplicated.
            This term’s bill is created from the class fee plan and the parent gets their login by SMS.
          </p>
          <div className="flex items-center justify-between border-t border-border pt-4 sm:col-span-2">
            <Link href="/students" className={btnGhostCls}>Cancel</Link>
            <SubmitButton className={btnCls + " h-12 px-8 text-[16px]"} pendingText="Saving…">Save student</SubmitButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
