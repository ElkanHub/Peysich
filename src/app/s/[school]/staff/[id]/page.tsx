import Link from "next/link";
import { and, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { staff, classes, subjects, teachingAssignments, timetableEntries } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { r2Enabled, presignDownload } from "@/lib/r2";
import { Card, Field, PageHeader, Badge, inputCls, btnGhostCls } from "@/ui/kit";
import { IssueLoginButton, ResetPasswordButton } from "@/ui/issue-login";
import { SubmitButton } from "@/ui/feedback";
import { StaffPhotoUploader } from "../photo";
import { updateStaffCard, markStaffLeft, reinstateStaff } from "../staff-actions";

const ghs = (p: number) => `GHS ${(p / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
const TYPE_LABEL: Record<string, string> = { teaching: "Teaching", admin: "Administrative", support: "Support" };

/** THE STAFF FILE — one employee, everything HR keeps: personal, contract,
 *  qualifications, payroll (admins only), portal access, teaching load. */
export default async function StaffFile({ params }: {
  params: Promise<{ school: string; id: string }>;
}) {
  const { school: slug, id } = await params;
  const { school } = await requireSchool(slug, ["admin"]);
  const [s] = await db.select().from(staff)
    .where(and(eq(staff.id, id), eq(staff.schoolId, school.id)));
  if (!s) notFound();
  const teaching = s.staffType === "teaching";

  const [homeClasses, allocations, [periods], subs] = await Promise.all([
    db.select({ id: classes.id, name: classes.name }).from(classes)
      .where(and(eq(classes.schoolId, school.id), eq(classes.classTeacherId, id))),
    teaching
      ? db.select({ className: classes.name, subjectName: subjects.name })
          .from(teachingAssignments)
          .innerJoin(classes, eq(teachingAssignments.classId, classes.id))
          .innerJoin(subjects, eq(teachingAssignments.subjectId, subjects.id))
          .where(eq(teachingAssignments.teacherId, id))
          .orderBy(classes.name, subjects.name)
      : [],
    db.select({ n: sql<number>`count(*)` }).from(timetableEntries)
      .innerJoin(teachingAssignments, and(
        eq(teachingAssignments.classId, timetableEntries.classId),
        eq(teachingAssignments.subjectId, timetableEntries.subjectId),
        eq(teachingAssignments.teacherId, id)))
      .where(eq(timetableEntries.schoolId, school.id)),
    teaching ? db.select().from(subjects).where(eq(subjects.schoolId, school.id)).orderBy(subjects.name) : [],
  ]);
  const photoUrl = s.photoUrl && r2Enabled ? await presignDownload(s.photoUrl) : null;
  const initials = s.name.split(" ").map((w) => w[0]).slice(0, 2).join("");

  return (
    <div className="max-w-3xl">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft text-lg font-semibold text-primary">
            {photoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={photoUrl} alt="" className="h-full w-full object-cover" />
              : initials}
          </span>
          <div>
            <h1 className="text-[22px] font-semibold leading-tight tracking-tight">{s.name}</h1>
            <p className="mt-0.5 text-[14px] text-muted-foreground">
              {s.staffNo ?? "—"} · {s.designation ?? TYPE_LABEL[s.staffType]}
              <span className="ml-2"><Badge tone={s.status === "active" ? "success" : "default"}>{s.status}</Badge></span>
              <span className="ml-1.5"><Badge tone={teaching ? "brand" : "default"}>{TYPE_LABEL[s.staffType]}</Badge></span>
            </p>
          </div>
        </div>
        {teaching && s.status === "active" && (
          <Link href="/staff/allocations" className={btnGhostCls + " shrink-0"}>Teaching & allocations</Link>
        )}
      </div>

      {s.status === "left" && (
        <div className="mb-5 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
          <p className="font-medium">Left the school on {s.exitDate}{s.exitNote ? ` — ${s.exitNote}` : ""}</p>
          <form action={reinstateStaff.bind(null, slug, id)} className="mt-1.5">
            <SubmitButton className="text-[14px] font-medium text-primary underline-offset-2 hover:underline">
              Reinstate (recorded in error / re-hired)
            </SubmitButton>
          </form>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Personal & contact</h2>
          <form action={updateStaffCard.bind(null, slug, id, "personal")} className="mt-3 grid grid-cols-2 gap-2.5">
            <Field label="Full name"><input name="name" defaultValue={s.name} required className={inputCls} /></Field>
            <Field label="Phone"><input name="phone" defaultValue={s.phone ?? ""} className={inputCls} /></Field>
            <Field label="Email"><input name="email" type="email" defaultValue={s.email ?? ""} className={inputCls} /></Field>
            <Field label="Date of birth"><input name="dob" type="date" defaultValue={s.dob ?? ""} className={inputCls} /></Field>
            <Field label="Nationality"><input name="nationality" defaultValue={s.nationality ?? ""} className={inputCls} /></Field>
            <Field label="National ID"><input name="idNumber" defaultValue={s.idNumber ?? ""} className={inputCls} /></Field>
            <Field label="Address"><input name="address" defaultValue={s.address ?? ""} className={inputCls} /></Field>
            <div />
            <Field label="Emergency name"><input name="emergencyName" defaultValue={s.emergencyName ?? ""} className={inputCls} /></Field>
            <Field label="Emergency phone"><input name="emergencyPhone" defaultValue={s.emergencyPhone ?? ""} className={inputCls} /></Field>
            <SubmitButton className={btnGhostCls + " col-span-2"} pendingText="Saving…">Save personal details</SubmitButton>
          </form>
          <div className="mt-4 border-t border-border pt-4">
            <StaffPhotoUploader slug={slug} staffId={id} enabled={r2Enabled} currentUrl={photoUrl} initials={initials} />
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <h2 className="font-semibold">Employment & contract</h2>
            <form action={updateStaffCard.bind(null, slug, id, "employment")} className="mt-3 grid grid-cols-2 gap-2.5">
              <Field label="Employee ID"><input name="staffNo" defaultValue={s.staffNo ?? ""} className={inputCls} /></Field>
              <Field label="Designation"><input name="designation" defaultValue={s.designation ?? ""} className={inputCls} /></Field>
              <Field label="Category">
                <select name="staffType" defaultValue={s.staffType} className={inputCls}>
                  <option value="teaching">Teaching</option>
                  <option value="admin">Administrative</option>
                  <option value="support">Support</option>
                </select>
              </Field>
              <Field label="Employment">
                <select name="employmentType" defaultValue={s.employmentType} className={inputCls}>
                  <option value="full_time">Full-time</option>
                  <option value="part_time">Part-time</option>
                  <option value="contract">Contract</option>
                </select>
              </Field>
              <Field label="Joined"><input name="joinedOn" type="date" defaultValue={s.joinedOn ?? ""} className={inputCls} /></Field>
              <Field label="Probation ends"><input name="probationEnd" type="date" defaultValue={s.probationEnd ?? ""} className={inputCls} /></Field>
              <SubmitButton className={btnGhostCls + " col-span-2"} pendingText="Saving…">Save employment</SubmitButton>
            </form>
          </Card>

          <Card>
            <h2 className="font-semibold">Portal access</h2>
            <div className="mt-2.5 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Login ({s.staffRole})</span>
              {s.userId
                ? <span className="inline-flex items-center gap-2">
                    <span className="text-xs text-success">active</span>
                    <ResetPasswordButton slug={slug} kind="staff" id={s.id} />
                  </span>
                : <IssueLoginButton slug={slug} kind="staff" id={s.id} />}
            </div>
          </Card>
        </div>

        {teaching && (
          <Card className="md:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Teaching load</h2>
              <span className="text-[14px] text-muted-foreground" data-nums="">
                {allocations.length} class-subject{allocations.length === 1 ? "" : "s"} · {Number(periods.n)} periods/week
              </span>
            </div>
            <dl className="mt-2.5 space-y-1.5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Class teacher of</dt>
                <dd className="text-right">{homeClasses.length ? homeClasses.map((c) => c.name).join(", ") : "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 text-muted-foreground">Subject teaching</dt>
                <dd className="text-right">
                  {allocations.length
                    ? allocations.map((a) => `${a.className} · ${a.subjectName}`).join(";  ")
                    : <span className="text-muted-foreground">None yet — assign on Teaching & allocations</span>}
                </dd>
              </div>
            </dl>
          </Card>
        )}

        {teaching && (
          <Card className="md:col-span-2">
            <h2 className="font-semibold">Qualifications & specialisations</h2>
            <form action={updateStaffCard.bind(null, slug, id, "qualifications")} className="mt-3 grid grid-cols-2 gap-2.5">
              <Field label="Highest qualification"><input name="qualification" defaultValue={s.qualification ?? ""} className={inputCls} /></Field>
              <Field label="Institution"><input name="institution" defaultValue={s.institution ?? ""} className={inputCls} /></Field>
              <Field label="Teacher licence / GES no."><input name="licenseNo" defaultValue={s.licenseNo ?? ""} className={inputCls} /></Field>
              <div />
              <div className="col-span-2">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subjects qualified to teach</p>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {subs.map((sub) => (
                    <label key={sub.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name={`comp_${sub.name}`}
                        defaultChecked={s.competencies.includes(sub.name)} /> {sub.name}
                    </label>
                  ))}
                </div>
              </div>
              <SubmitButton className={btnGhostCls + " col-span-2"} pendingText="Saving…">Save qualifications</SubmitButton>
            </form>
          </Card>
        )}

        <Card>
          <h2 className="font-semibold">Payroll & statutory</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">Visible to school admins only.</p>
          <form action={updateStaffCard.bind(null, slug, id, "payroll")} className="mt-3 grid grid-cols-2 gap-2.5">
            <Field label="Bank"><input name="bankName" defaultValue={s.bankName ?? ""} className={inputCls} /></Field>
            <Field label="Branch"><input name="bankBranch" defaultValue={s.bankBranch ?? ""} className={inputCls} /></Field>
            <Field label="Account no."><input name="accountNo" defaultValue={s.accountNo ?? ""} className={inputCls} /></Field>
            <Field label="SSNIT"><input name="ssnitNo" defaultValue={s.ssnitNo ?? ""} className={inputCls} /></Field>
            <Field label="TIN"><input name="tinNo" defaultValue={s.tinNo ?? ""} className={inputCls} /></Field>
            <Field label="Monthly salary (GHS)">
              <input name="salaryGhs" type="number" step="0.01" min="0"
                defaultValue={s.salaryPesewas ? s.salaryPesewas / 100 : ""} className={inputCls} />
            </Field>
            <SubmitButton className={btnGhostCls + " col-span-2"} pendingText="Saving…">Save payroll</SubmitButton>
          </form>
          {s.salaryPesewas != null && (
            <p className="mt-2 text-[13px] text-muted-foreground" data-nums="">Current: {ghs(s.salaryPesewas)}/month</p>
          )}
        </Card>

        {s.status === "active" && (
          <Card>
            <h2 className="font-semibold text-danger">Offboarding</h2>
            <p className="mt-0.5 text-[14px] text-muted-foreground">
              Marks the record as left (never deleted), releases their class-teacher role and every subject allocation.
            </p>
            <form action={markStaffLeft.bind(null, slug, id)} className="mt-3 grid grid-cols-2 gap-2.5">
              <Field label="Last working day">
                <input name="exitDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className={inputCls} />
              </Field>
              <Field label="Note"><input name="exitNote" placeholder="Resigned — relocating" className={inputCls} /></Field>
              <SubmitButton className={btnGhostCls + " col-span-2 text-danger"} pendingText="Recording…">
                Mark as left
              </SubmitButton>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
