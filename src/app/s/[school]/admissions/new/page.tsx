import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { levels } from "@/db/schema";
import { requireModule } from "@/core/school-context";
import { Card, Field, PageHeader, inputCls, btnCls } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";
import { addApplicant } from "../actions";

const ERR: Record<string, string> = {
  req: "The child's name and a guardian phone are required — everything else can come later.",
};

/** A walk-in takes 30 seconds: name, level, guardian phone. The rest of
 *  the file fills in as screening happens. */
export default async function NewApplication({ params, searchParams }: {
  params: Promise<{ school: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  const { school: slug } = await params;
  const sp = await searchParams;
  const { school } = await requireModule(slug, "admissions", ["admin"]);
  const lvs = await db.select().from(levels)
    .where(eq(levels.schoolId, school.id)).orderBy(levels.sortOrder);

  return (
    <div className="max-w-xl">
      <PageHeader title="New application"
        sub="Only the starred fields are needed now — more guardians can be added on the file" />
      <p className="-mt-3 mb-4">
        <Link href="/admissions" className="text-[13.5px] font-medium text-primary">← Admissions desk</Link>
      </p>
      {sp.err && ERR[sp.err] && (
        <p className="mb-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{ERR[sp.err]}</p>
      )}
      <Card>
        <form action={addApplicant.bind(null, slug)} className="grid gap-3 sm:grid-cols-2">
          <Field label="Child's full name *"><input name="name" required className={inputCls} /></Field>
          <Field label="Level applying for *">
            <select name="levelId" className={inputCls}>
              {lvs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
          <Field label="Date of birth"><input name="dob" type="date" className={inputCls} /></Field>
          <Field label="Sex">
            <select name="sex" className={inputCls}>
              <option value="">—</option><option value="female">Female</option><option value="male">Male</option>
            </select>
          </Field>
          <Field label="Guardian name"><input name="guardianName" className={inputCls} /></Field>
          <Field label="Guardian phone *"><input name="guardianPhone" required className={inputCls} /></Field>
          <Field label="Guardian email (offers go by email too)">
            <input name="guardianEmail" type="email" className={inputCls} /></Field>
          <Field label="Relationship">
            <select name="relation" className={inputCls}>
              {["parent", "mother", "father", "guardian", "grandparent", "other"].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </Field>
          <Field label="Previous school"><input name="prevSchool" className={inputCls} /></Field>
          <Field label="How they heard of us">
            <input name="source" placeholder="e.g. church member referral" className={inputCls} />
          </Field>
          <SubmitButton className={btnCls + " sm:col-span-2"} pendingText="Saving…">
            Add to the pipeline
          </SubmitButton>
        </form>
      </Card>
    </div>
  );
}
