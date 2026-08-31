import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { staff, subjects } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { r2Enabled, presignDownload } from "@/lib/r2";
import { Card, Field, PageHeader, inputCls, btnCls, btnGhostCls } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";
import { StaffPhotoUploader } from "../photo";
import {
  startOnboarding, savePersonal, saveEmployment, saveQualifications,
  savePayroll, saveAccess, completeOnboarding, discardOnboarding,
} from "../staff-actions";
import { cn } from "@/lib/utils";

const STAGES = ["Personal", "Employment", "Qualifications", "Payroll", "Access", "Review"];
const ERR: Record<string, string> = { name: "Full name is required." };

/** STAFF ONBOARDING — hire, don't admit. Six resumable stages; a draft is
 *  invisible everywhere until completed. Stage 3 applies to teaching staff
 *  only and is skipped automatically for admin/support hires. */
export default async function AddStaff({ params, searchParams }: {
  params: Promise<{ school: string }>;
  searchParams: Promise<{ draft?: string; step?: string; err?: string; portal?: string }>;
}) {
  const { school: slug } = await params;
  const sp = await searchParams;
  const { school } = await requireSchool(slug, ["admin"]);
  const s = sp.draft
    ? (await db.select().from(staff)
        .where(and(eq(staff.id, sp.draft), eq(staff.schoolId, school.id))))[0]
    : null;
  const teaching = !s || s.staffType === "teaching";
  const maxStep = s ? (s.onboardingStep ?? 0) : 0;
  const step = s ? Math.min(Math.max(1, Number(sp.step) || maxStep + 1), 6) : 1;

  return (
    <div className="max-w-3xl">
      <PageHeader title={s ? `Onboarding — ${s.name}` : "Add staff"}
        sub="Stage-by-stage hire. Progress saves at every step — you can finish later." />

      <div className="mb-5 flex flex-wrap gap-1.5">
        {STAGES.map((label, i) => {
          const n = i + 1;
          const skipped = n === 3 && !teaching;
          const reachable = !skipped && (s ? n <= Math.min(maxStep + 1, 6) : n === 1);
          const cls = cn("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
            skipped ? "border-dashed border-border text-faint line-through"
              : n === step ? "border-primary bg-brand-soft text-primary"
              : n <= maxStep ? "border-border text-foreground hover:bg-muted"
              : "border-border text-faint");
          const inner = <>
            <span className={cn("flex h-4 w-4 items-center justify-center rounded-full text-[11px]",
              !skipped && n <= maxStep ? "bg-brand-container text-on-brand-container"
                : n === step ? "bg-primary/20 text-primary" : "bg-muted")}>
              {!skipped && n <= maxStep ? "✓" : n}
            </span>
            {label}
          </>;
          return reachable && s
            ? <Link key={label} href={`?draft=${s.id}&step=${n}`} className={cls}>{inner}</Link>
            : <span key={label} className={cls} title={skipped ? "Teaching staff only" : undefined}>{inner}</span>;
        })}
      </div>

      {sp.err && ERR[sp.err] && (
        <p className="mb-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{ERR[sp.err]}</p>
      )}

      {step === 1 && <PersonalStage slug={slug} s={s} />}
      {s && step === 2 && <EmploymentStage slug={slug} s={s} />}
      {s && step === 3 && teaching && <QualificationsStage slug={slug} s={s} schoolId={school.id} />}
      {s && step === 4 && <PayrollStage slug={slug} s={s} />}
      {s && step === 5 && <AccessStage slug={slug} s={s} />}
      {s && step === 6 && <ReviewStage slug={slug} s={s} portalNone={sp.portal === "none"} />}
    </div>
  );
}

type S = typeof staff.$inferSelect;

function Footer({ back, label = "Save & continue" }: { back?: string; label?: string }) {
  return (
    <div className="col-span-2 mt-1 flex items-center justify-between border-t border-border pt-4">
      {back ? <Link href={back} className={btnGhostCls}>Back</Link> : <span />}
      <SubmitButton className={btnCls}>{label}</SubmitButton>
    </div>
  );
}

function PersonalStage({ slug, s }: { slug: string; s: S | null }) {
  const action = s ? savePersonal.bind(null, slug, s.id) : startOnboarding.bind(null, slug);
  return (
    <Card>
      <h2 className="font-semibold">Personal & contact</h2>
      <p className="mt-0.5 text-[14px] text-muted-foreground">Who they are and how to reach them. The passport photo is added at Review.</p>
      <form action={action} className="mt-4 grid grid-cols-2 gap-3">
        <Field label="Full name"><input name="name" required defaultValue={s?.name} className={inputCls} /></Field>
        <Field label="Phone"><input name="phone" defaultValue={s?.phone ?? ""} className={inputCls} /></Field>
        <Field label="Email"><input name="email" type="email" defaultValue={s?.email ?? ""} className={inputCls} /></Field>
        <Field label="Date of birth"><input name="dob" type="date" defaultValue={s?.dob ?? ""} className={inputCls} /></Field>
        <Field label="Nationality"><input name="nationality" defaultValue={s?.nationality ?? ""} placeholder="Ghanaian" className={inputCls} /></Field>
        <Field label="National ID (Ghana Card)"><input name="idNumber" defaultValue={s?.idNumber ?? ""} placeholder="GHA-XXXXXXXXX-X" className={inputCls} /></Field>
        <Field label="Residential address"><input name="address" defaultValue={s?.address ?? ""} className={inputCls} /></Field>
        <div />
        <Field label="Emergency contact name"><input name="emergencyName" defaultValue={s?.emergencyName ?? ""} className={inputCls} /></Field>
        <Field label="Emergency contact phone"><input name="emergencyPhone" defaultValue={s?.emergencyPhone ?? ""} className={inputCls} /></Field>
        <Footer back={s ? undefined : "/staff"} label={s ? "Save & continue" : "Start onboarding"} />
      </form>
    </Card>
  );
}

function EmploymentStage({ slug, s }: { slug: string; s: S }) {
  return (
    <Card>
      <h2 className="font-semibold">Employment & contract</h2>
      <p className="mt-0.5 text-[14px] text-muted-foreground">
        Picking <b>Teaching</b> adds the Qualifications stage; admin &amp; support skip it.
      </p>
      <form action={saveEmployment.bind(null, slug, s.id)} className="mt-4 grid grid-cols-2 gap-3">
        <Field label="Employee ID"><input name="staffNo" defaultValue={s.staffNo ?? ""} className={inputCls} /></Field>
        <Field label="Designation / job title">
          <input name="designation" defaultValue={s.designation ?? ""} placeholder="Lead Teacher · Head Cook · Driver" className={inputCls} />
        </Field>
        <Field label="Staff category">
          <select name="staffType" defaultValue={s.staffType} className={inputCls}>
            <option value="teaching">Teaching</option>
            <option value="admin">Administrative</option>
            <option value="support">Support (kitchen, security, drivers…)</option>
          </select>
        </Field>
        <Field label="Employment type">
          <select name="employmentType" defaultValue={s.employmentType} className={inputCls}>
            <option value="full_time">Full-time</option>
            <option value="part_time">Part-time</option>
            <option value="contract">Contract</option>
          </select>
        </Field>
        <Field label="Joining date"><input name="joinedOn" type="date" defaultValue={s.joinedOn ?? ""} className={inputCls} /></Field>
        <Field label="Probation ends"><input name="probationEnd" type="date" defaultValue={s.probationEnd ?? ""} className={inputCls} /></Field>
        <Footer back={`?draft=${s.id}&step=1`} />
      </form>
    </Card>
  );
}

async function QualificationsStage({ slug, s, schoolId }: { slug: string; s: S; schoolId: string }) {
  const subs = await db.select().from(subjects).where(eq(subjects.schoolId, schoolId)).orderBy(subjects.name);
  return (
    <Card>
      <h2 className="font-semibold">Qualifications & specialisations</h2>
      <p className="mt-0.5 text-[14px] text-muted-foreground">
        Competencies power the allocation screen — assigning outside them warns, never blocks.
      </p>
      <form action={saveQualifications.bind(null, slug, s.id)} className="mt-4 grid grid-cols-2 gap-3">
        <Field label="Highest qualification"><input name="qualification" defaultValue={s.qualification ?? ""} placeholder="B.Ed Basic Education" className={inputCls} /></Field>
        <Field label="Institution"><input name="institution" defaultValue={s.institution ?? ""} className={inputCls} /></Field>
        <Field label="Teacher licence / GES no."><input name="licenseNo" defaultValue={s.licenseNo ?? ""} className={inputCls} /></Field>
        <div />
        <div className="col-span-2">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subjects qualified to teach</p>
          {subs.length === 0
            ? <p className="text-sm text-muted-foreground">Set up subjects in Settings first — you can fill this later.</p>
            : (
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {subs.map((sub) => (
                  <label key={sub.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name={`comp_${sub.name}`}
                      defaultChecked={s.competencies.includes(sub.name)} /> {sub.name}
                  </label>
                ))}
              </div>
            )}
        </div>
        <Footer back={`?draft=${s.id}&step=2`} />
      </form>
    </Card>
  );
}

function PayrollStage({ slug, s }: { slug: string; s: S }) {
  return (
    <Card>
      <h2 className="font-semibold">Payroll & statutory</h2>
      <p className="mt-0.5 text-[14px] text-muted-foreground">
        Visible to admins only. Everything here is optional — finalise it after the contract is signed.
      </p>
      <form action={savePayroll.bind(null, slug, s.id)} className="mt-4 grid grid-cols-2 gap-3">
        <Field label="Bank"><input name="bankName" defaultValue={s.bankName ?? ""} className={inputCls} /></Field>
        <Field label="Branch"><input name="bankBranch" defaultValue={s.bankBranch ?? ""} className={inputCls} /></Field>
        <Field label="Account number"><input name="accountNo" defaultValue={s.accountNo ?? ""} className={inputCls} /></Field>
        <Field label="SSNIT number"><input name="ssnitNo" defaultValue={s.ssnitNo ?? ""} className={inputCls} /></Field>
        <Field label="TIN"><input name="tinNo" defaultValue={s.tinNo ?? ""} className={inputCls} /></Field>
        <Field label="Monthly salary (GHS)">
          <input name="salaryGhs" type="number" step="0.01" min="0"
            defaultValue={s.salaryPesewas ? s.salaryPesewas / 100 : ""} className={inputCls} />
        </Field>
        <Footer back={`?draft=${s.id}&step=${s.staffType === "teaching" ? 3 : 2}`} />
      </form>
    </Card>
  );
}

function AccessStage({ slug, s }: { slug: string; s: S }) {
  return (
    <Card>
      <h2 className="font-semibold">System access</h2>
      <p className="mt-0.5 text-[14px] text-muted-foreground">
        What can they do in Peysich? Support staff usually need no portal at all — their record still lives here.
      </p>
      <form action={saveAccess.bind(null, slug, s.id)} className="mt-4 grid gap-3">
        <Field label="Portal role">
          <select name="portalRole" defaultValue={s.staffType === "teaching" ? "teacher" : "none"} className={inputCls}>
            <option value="teacher">Teacher — registers, score sheets, homework for their classes</option>
            <option value="admin">Admin — full school management</option>
            <option value="bursar">Bursar — fees & finance (admin access)</option>
            <option value="none">No portal access</option>
          </select>
        </Field>
        <Footer back={`?draft=${s.id}&step=4`} />
      </form>
    </Card>
  );
}

async function ReviewStage({ slug, s, portalNone }: { slug: string; s: S; portalNone: boolean }) {
  const photoUrl = s.photoUrl && r2Enabled ? await presignDownload(s.photoUrl) : null;
  const rows: [string, string | null][] = [
    ["Name", s.name],
    ["Employee ID · joined", `${s.staffNo ?? "—"} · ${s.joinedOn ?? "—"}`],
    ["Category · designation", `${s.staffType} · ${s.designation ?? "—"}`],
    ["Employment", s.employmentType.replace("_", "-")],
    ["Contact", [s.phone, s.email].filter(Boolean).join(" · ") || "—"],
    ["Emergency", s.emergencyName ? `${s.emergencyName} · ${s.emergencyPhone ?? ""}` : "—"],
    ...(s.staffType === "teaching" ? [
      ["Qualification", s.qualification ?? "—"] as [string, string],
      ["Subjects", s.competencies.length ? s.competencies.join(", ") : "—"] as [string, string],
    ] : []),
  ];
  return (
    <div className="space-y-4">
      <Card>
        <h2 className="font-semibold">Review & complete</h2>
        <div className="mt-3 flex items-start gap-4">
          <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft text-xl font-semibold text-primary">
            {photoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={photoUrl} alt="" className="h-full w-full object-cover" />
              : s.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
          </span>
          <dl className="flex-1 space-y-1.5 text-sm">
            {rows.map(([l, v]) => (
              <div key={l} className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{l}</dt>
                <dd className="text-right capitalize">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="mt-4 border-t border-border pt-4">
          <StaffPhotoUploader slug={slug} staffId={s.id} enabled={r2Enabled} currentUrl={photoUrl} />
        </div>
      </Card>
      <Card>
        <h2 className="font-semibold">Provisioning</h2>
        <form action={completeOnboarding.bind(null, slug, s.id)} className="mt-3 space-y-2.5 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="issueLogin" defaultChecked={!portalNone} disabled={portalNone} />
            {portalNone
              ? "No portal access chosen — no login will be created (changeable later on the Staff File)."
              : `Issue a ${s.staffRole} login now (credentials appear on the Staff File)`}
          </label>
          {s.staffType === "teaching" && (
            <p className="text-[14px] text-muted-foreground">
              After completing, assign their classes and subjects on <b>Teaching &amp; allocations</b>.
            </p>
          )}
          <div className="mt-2 flex items-center justify-between border-t border-border pt-4">
            <Link href={`?draft=${s.id}&step=5`} className={btnGhostCls}>Back</Link>
            <SubmitButton className={btnCls} pendingText="Completing…">Complete onboarding</SubmitButton>
          </div>
        </form>
        <form action={discardOnboarding.bind(null, slug, s.id)} className="mt-3 text-right">
          <SubmitButton className="text-xs text-danger underline-offset-2 hover:underline">Discard this draft</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
