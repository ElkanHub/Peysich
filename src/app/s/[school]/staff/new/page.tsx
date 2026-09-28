import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { staff } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { Card, Field, PageHeader, inputCls, btnCls, btnGhostCls } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";
import { addStaff } from "../staff-actions";

/** ADD STAFF — one screen, one Save. Employment, qualifications, payroll,
 *  photo and signature live under "Add more details" on their page.
 *  `?draft=` finishes a draft the old stage-by-stage form left behind. */
export default async function AddStaff({ params, searchParams }: {
  params: Promise<{ school: string }>;
  searchParams: Promise<{ draft?: string }>;
}) {
  const { school: slug } = await params;
  const { draft } = await searchParams;
  const { school } = await requireSchool(slug, ["admin"]);
  const s = draft
    ? (await db.select().from(staff).where(and(eq(staff.id, draft), eq(staff.schoolId, school.id))))[0]
    : null;

  return (
    <div className="max-w-xl">
      <PageHeader title="Add staff" sub="Name, phone and what they do. Everything else can wait." />
      <Card>
        <form action={addStaff.bind(null, slug, s?.id ?? null)} className="grid gap-4">
          <Field label="Full name"><input name="name" required autoFocus defaultValue={s?.name} className={inputCls} /></Field>
          <Field label="Phone"><input name="phone" type="tel" defaultValue={s?.phone ?? ""} placeholder="024 XXX XXXX" className={inputCls} /></Field>
          <Field label="What do they do?">
            <select name="staffType" defaultValue={s?.staffType ?? "teaching"} className={inputCls}>
              <option value="teaching">Teacher</option>
              <option value="admin">Office (fees, records)</option>
              <option value="support">Support (kitchen, security, drivers…)</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 text-[14.5px]">
            <input type="checkbox" name="sendLogin" defaultChecked /> Send them a login by SMS
          </label>
          <p className="text-[13.5px] text-muted-foreground">
            Only the name is required. A teacher’s login opens registers and score sheets for their classes;
            an office login opens Fees, Students and Parents. Support staff get no login. You can change this on their page.
          </p>
          <div className="flex items-center justify-between border-t border-border pt-4">
            <Link href="/staff" className={btnGhostCls}>Cancel</Link>
            <SubmitButton className={btnCls + " h-12 px-8 text-[16px]"} pendingText="Saving…">Save</SubmitButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
