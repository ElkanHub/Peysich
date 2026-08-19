import Link from "next/link";
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  students, classes, guardians, studentGuardians, studentFiles, studentItems,
  feeStructures,
} from "@/db/schema";
import { requireSchool, getCurrentTerm } from "@/core/school-context";
import { r2Enabled, presignDownload } from "@/lib/r2";
import { Card, DataTable, Empty, Field, PageHeader, Tr, Td, Badge, inputCls, btnCls, btnGhostCls } from "@/ui/kit";
import { PhotoUploader, DocumentUploader } from "../[id]/uploaders";
import { addStudentItem } from "../[id]/actions";
import {
  startAdmission, saveIdentity, savePlacement, addAdmissionGuardian,
  removeAdmissionGuardian, saveEmergency, saveHealth, advanceStep,
  completeAdmission, discardAdmission,
} from "./wizard-actions";
import { cn } from "@/lib/utils";

const STAGES = ["Identity", "Placement", "Guardians", "Health", "Documents", "Billing", "Review"];
const ERR: Record<string, string> = {
  name: "First and last name are required.",
  cap: "Student limit reached for your plan — upgrade in Billing to admit more.",
  admno: "That admission number is already taken by another student.",
  noclass: "Pick a class in the Placement stage before completing admission.",
};
const ghs = (p: number) => `GHS ${(p / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

/** The ADMISSION WIZARD — add student = enrol student, stage by stage.
 *  Every stage saves on continue; an unfinished admission is a DRAFT the
 *  office can come back to (it never appears on registers until completed). */
export default async function AdmitStudent({ params, searchParams }: {
  params: Promise<{ school: string }>;
  searchParams: Promise<{ draft?: string; step?: string; err?: string }>;
}) {
  const { school: slug } = await params;
  const sp = await searchParams;
  const { school } = await requireSchool(slug, ["admin"]);

  const s = sp.draft
    ? (await db.select().from(students)
        .where(and(eq(students.id, sp.draft), eq(students.schoolId, school.id))))[0]
    : null;
  const maxStep = s ? (s.admissionStep ?? 0) : 0;
  const step = s ? Math.min(Math.max(1, Number(sp.step) || maxStep + 1), 7) : 1;

  return (
    <div className="max-w-3xl">
      <PageHeader title={s ? `Admitting — ${s.firstName} ${s.lastName}` : "Admit student"}
        sub="Stage-by-stage enrolment. Progress saves at every step — you can finish later." />

      {/* stage rail — one place, always */}
      <div className="mb-5 flex flex-wrap gap-1.5">
        {STAGES.map((label, i) => {
          const n = i + 1;
          const reachable = s ? n <= Math.min(maxStep + 1, 7) : n === 1;
          const cls = cn("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
            n === step ? "border-primary bg-brand-soft text-primary"
              : n <= maxStep ? "border-border text-foreground hover:bg-muted"
              : "border-border text-faint");
          const inner = <>
            <span className={cn("flex h-4 w-4 items-center justify-center rounded-full text-[10px]",
              n <= maxStep ? "bg-primary text-primary-foreground" : n === step ? "bg-primary/20 text-primary" : "bg-muted")}>
              {n <= maxStep ? "✓" : n}
            </span>
            {label}
          </>;
          return reachable && s
            ? <Link key={label} href={`?draft=${s.id}&step=${n}`} className={cls}>{inner}</Link>
            : <span key={label} className={cls}>{inner}</span>;
        })}
      </div>

      {sp.err && ERR[sp.err] && (
        <p className="mb-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{ERR[sp.err]}</p>
      )}

      {step === 1 && <IdentityStage slug={slug} s={s} />}
      {s && step === 2 && <PlacementStage slug={slug} s={s} schoolId={school.id} err={sp.err} />}
      {s && step === 3 && <GuardiansStage slug={slug} s={s} />}
      {s && step === 4 && <HealthStage slug={slug} s={s} />}
      {s && step === 5 && <DocumentsStage slug={slug} s={s} />}
      {s && step === 6 && <BillingStage slug={slug} s={s} schoolId={school.id} />}
      {s && step === 7 && <ReviewStage slug={slug} s={s} schoolId={school.id} />}
    </div>
  );
}

type S = typeof students.$inferSelect;

function Footer({ back, label = "Save & continue" }: { back?: string; label?: string }) {
  return (
    <div className="col-span-2 mt-1 flex items-center justify-between border-t border-border pt-4">
      {back ? <Link href={back} className={btnGhostCls}>Back</Link> : <span />}
      <button className={btnCls}>{label}</button>
    </div>
  );
}

function IdentityStage({ slug, s }: { slug: string; s: S | null }) {
  const action = s ? saveIdentity.bind(null, slug, s.id) : startAdmission.bind(null, slug);
  return (
    <Card>
      <h2 className="font-semibold">Basic & personal information</h2>
      <p className="mt-0.5 text-[13px] text-muted-foreground">Who the child is and where they live. The passport photo is added at Review.</p>
      <form action={action} className="mt-4 grid grid-cols-2 gap-3">
        <Field label="First name"><input name="firstName" required defaultValue={s?.firstName} className={inputCls} /></Field>
        <Field label="Last name"><input name="lastName" required defaultValue={s?.lastName} className={inputCls} /></Field>
        <Field label="Other names"><input name="otherNames" defaultValue={s?.otherNames ?? ""} className={inputCls} /></Field>
        <Field label="Sex">
          <select name="sex" defaultValue={s?.sex ?? "male"} className={inputCls}>
            <option value="male">Male</option><option value="female">Female</option>
          </select>
        </Field>
        <Field label="Date of birth"><input name="dob" type="date" defaultValue={s?.dob ?? ""} className={inputCls} /></Field>
        <Field label="Place of birth"><input name="placeOfBirth" defaultValue={s?.placeOfBirth ?? ""} className={inputCls} /></Field>
        <Field label="Nationality"><input name="nationality" defaultValue={s?.nationality ?? ""} placeholder="Ghanaian" className={inputCls} /></Field>
        <Field label="Hometown"><input name="hometown" defaultValue={s?.hometown ?? ""} className={inputCls} /></Field>
        <Field label="Religion"><input name="religion" defaultValue={s?.religion ?? ""} className={inputCls} /></Field>
        <Field label="Residential address"><input name="address" defaultValue={s?.address ?? ""} className={inputCls} /></Field>
        <Footer back={s ? undefined : "/students"} label={s ? "Save & continue" : "Start admission"} />
      </form>
    </Card>
  );
}

async function PlacementStage({ slug, s, schoolId, err }: { slug: string; s: S; schoolId: string; err?: string }) {
  const cls = await db.select().from(classes).where(eq(classes.schoolId, schoolId));
  return (
    <Card>
      <h2 className="font-semibold">Academic & enrolment details</h2>
      <p className="mt-0.5 text-[13px] text-muted-foreground">Where the child is placed and how they attend.</p>
      <form action={savePlacement.bind(null, slug, s.id)} className="mt-4 grid grid-cols-2 gap-3">
        <Field label="Class placement">
          <select name="classId" defaultValue={s.classId ?? ""} className={inputCls}>
            <option value="">Choose later</option>
            {cls.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Admission number">
          <input name="admissionNo" defaultValue={s.admissionNo} className={cn(inputCls, err === "admno" && "border-danger")} />
        </Field>
        <Field label="Admission date"><input name="admittedOn" type="date" defaultValue={s.admittedOn ?? ""} className={inputCls} /></Field>
        <Field label="Attendance type">
          <label className="flex h-10 items-center gap-2 text-sm">
            <input type="checkbox" name="boarding" defaultChecked={s.boarding} /> Boarder (unticked = day student)
          </label>
        </Field>
        <Field label="Previous school & last grade completed">
          <input name="previousSchool" defaultValue={s.previousSchool ?? ""} placeholder="Sunrise Academy — completed B3" className={inputCls} />
        </Field>
        <div />
        <Footer back={`?draft=${s.id}&step=1`} />
      </form>
    </Card>
  );
}

async function GuardiansStage({ slug, s }: { slug: string; s: S }) {
  const gs = await db.select({
    id: guardians.id, name: guardians.name, phone: guardians.phone,
    relation: guardians.relation, isPrimary: studentGuardians.isPrimary,
  }).from(studentGuardians)
    .innerJoin(guardians, eq(studentGuardians.guardianId, guardians.id))
    .where(eq(studentGuardians.studentId, s.id));
  return (
    <div className="space-y-5">
      <Card>
        <h2 className="font-semibold">Parents & guardians</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Linked by phone number — a parent with children already in the school is reused, not duplicated.
        </p>
        {gs.length > 0 && (
          <ul className="mt-3 space-y-1.5 text-sm">
            {gs.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-2">
                <span><span className="font-medium">{g.name}</span>
                  <span className="ml-2 text-muted-foreground">{g.phone} · {g.relation}</span>
                  {g.isPrimary && <Badge tone="brand">primary</Badge>}</span>
                <form action={removeAdmissionGuardian.bind(null, slug, s.id, g.id)}>
                  <button className="rounded border border-border px-2 py-1 text-xs text-danger hover:bg-muted">Unlink</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={addAdmissionGuardian.bind(null, slug, s.id)}
          className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
          <Field label="Full name"><input name="name" required className={inputCls} /></Field>
          <Field label="Phone"><input name="phone" required placeholder="024 XXX XXXX" className={inputCls} /></Field>
          <Field label="Relation">
            <select name="relation" className={inputCls}>
              {["parent", "mother", "father", "grandparent", "aunt", "uncle", "sibling", "other"]
                .map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Email (optional)"><input name="email" type="email" className={inputCls} /></Field>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" name="isPrimary" defaultChecked={gs.length === 0} /> Primary contact (billing & pickups)
          </label>
          <button className={btnGhostCls + " col-span-2"}>Add guardian</button>
        </form>
      </Card>
      <Card>
        <h2 className="font-semibold">Emergency contact</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">Who the school calls if a guardian can’t be reached, and who may pick the child up.</p>
        <form action={saveEmergency.bind(null, slug, s.id)} className="mt-4 grid grid-cols-2 gap-3">
          <Field label="Name & relation"><input name="emergencyName" defaultValue={s.emergencyName ?? ""} placeholder="Uncle — Kwame Mensah" className={inputCls} /></Field>
          <Field label="Phone"><input name="emergencyPhone" defaultValue={s.emergencyPhone ?? ""} className={inputCls} /></Field>
          <Footer back={`?draft=${s.id}&step=2`} />
        </form>
      </Card>
    </div>
  );
}

function HealthStage({ slug, s }: { slug: string; s: S }) {
  return (
    <Card>
      <h2 className="font-semibold">Health & medical</h2>
      <p className="mt-0.5 text-[13px] text-muted-foreground">Allergies and conditions raise a flag teachers see on the class register.</p>
      <form action={saveHealth.bind(null, slug, s.id)} className="mt-4 grid grid-cols-2 gap-3">
        <Field label="Blood group">
          <select name="bloodGroup" defaultValue={s.bloodGroup ?? ""} className={inputCls}>
            <option value="">Unknown</option>
            {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => <option key={g}>{g}</option>)}
          </select>
        </Field>
        <div />
        <div className="col-span-2">
          <Field label="Allergies, chronic conditions, dietary restrictions, regular medication">
            <textarea name="medicalNotes" rows={3} defaultValue={s.medicalNotes ?? ""}
              placeholder="e.g. Asthmatic — inhaler in school bag. No groundnuts." className={inputCls} />
          </Field>
        </div>
        <Footer back={`?draft=${s.id}&step=3`} />
      </form>
    </Card>
  );
}

async function DocumentsStage({ slug, s }: { slug: string; s: S }) {
  const [files, items] = await Promise.all([
    db.select().from(studentFiles).where(eq(studentFiles.studentId, s.id)).orderBy(desc(studentFiles.createdAt)),
    db.select().from(studentItems).where(eq(studentItems.studentId, s.id)).orderBy(desc(studentItems.receivedAt)),
  ]);
  return (
    <div className="space-y-5">
      <Card>
        <h2 className="font-semibold">Digital documents</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">Birth certificate, immunization card, previous reports, transfer certificate.</p>
        {files.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm">
            {files.map((fl) => (
              <li key={fl.id} className="flex justify-between">
                <span className="font-medium">{fl.title}</span>
                <Badge>{fl.kind.replace(/_/g, " ")}</Badge>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4">
          {r2Enabled
            ? <DocumentUploader slug={slug} studentId={s.id} />
            : <Empty title="File storage not configured"
                hint="Uploads activate once R2 is set up — record originals in the custody register below." />}
        </div>
      </Card>
      <Card>
        <h2 className="font-semibold">Physical items into custody</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">Originals the office keeps — note exactly where each is stored.</p>
        {items.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm">
            {items.map((it) => (
              <li key={it.id} className="flex justify-between">
                <span className="font-medium">{it.itemName}</span>
                <span className="text-muted-foreground">{it.location}</span>
              </li>
            ))}
          </ul>
        )}
        <form action={addStudentItem.bind(null, slug, s.id)} className="mt-4 grid grid-cols-2 gap-3">
          <Field label="Item"><input name="itemName" placeholder="Birth certificate (original)" className={inputCls} /></Field>
          <Field label="Kept at (be precise)"><input name="location" placeholder="Office cabinet A · folder 12" className={inputCls} /></Field>
          <Field label="Received from"><input name="receivedFrom" className={inputCls} /></Field>
          <Field label="Note"><input name="note" className={inputCls} /></Field>
          <button className={btnGhostCls + " col-span-2"}>Record item</button>
        </form>
      </Card>
      <form action={advanceStep.bind(null, slug, s.id, 5)}>
        <Footer back={`?draft=${s.id}&step=4`} label="Continue" />
      </form>
    </div>
  );
}

async function BillingStage({ slug, s, schoolId }: { slug: string; s: S; schoolId: string }) {
  const term = await getCurrentTerm(schoolId);
  const [cls] = s.classId ? await db.select().from(classes).where(eq(classes.id, s.classId)) : [null];
  const items = term && cls
    ? await db.select().from(feeStructures).where(and(
        eq(feeStructures.schoolId, schoolId), eq(feeStructures.termId, term.id),
        eq(feeStructures.levelId, cls.levelId)))
    : [];
  const total = items.reduce((a, it) => a + it.amountPesewas, 0);
  return (
    <Card>
      <h2 className="font-semibold">Billing & fee configuration</h2>
      <p className="mt-0.5 text-[13px] text-muted-foreground">
        {cls
          ? `Fee plan for ${cls.name}${term ? ` · ${term.name}` : ""} — the invoice can be raised automatically at Review.`
          : "Pick a class in Placement to see the applicable fee plan."}
      </p>
      {items.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {items.map((it) => (
            <li key={it.id} className="flex justify-between">
              <span>{it.name}</span><span data-nums="">{ghs(it.amountPesewas)}</span>
            </li>
          ))}
          <li className="flex justify-between border-t border-border pt-1.5 font-semibold">
            <span>Term total</span><span data-nums="">{ghs(total)}</span>
          </li>
        </ul>
      )}
      <form action={advanceStep.bind(null, slug, s.id, 6)} className="mt-4 grid gap-3">
        <Field label="Payment arrangement — how & where this family pays (kept on the student file)">
          <textarea name="paymentNote" rows={2} defaultValue={s.paymentNote ?? ""}
            placeholder='e.g. "Father pays via MoMo 024 XXX XXXX, week 2 of term. Sibling discount approved by head."'
            className={inputCls} />
        </Field>
        <Footer back={`?draft=${s.id}&step=5`} />
      </form>
    </Card>
  );
}

async function ReviewStage({ slug, s, schoolId }: { slug: string; s: S; schoolId: string }) {
  const [cls] = s.classId ? await db.select().from(classes).where(eq(classes.id, s.classId)) : [null];
  const gs = await db.select({ name: guardians.name, phone: guardians.phone })
    .from(studentGuardians).innerJoin(guardians, eq(studentGuardians.guardianId, guardians.id))
    .where(eq(studentGuardians.studentId, s.id));
  const photoUrl = s.photoUrl && r2Enabled ? await presignDownload(s.photoUrl) : null;
  const rows: [string, string | null][] = [
    ["Name", `${s.firstName} ${s.otherNames ?? ""} ${s.lastName}`.replace(/\s+/g, " ")],
    ["Sex · DOB", `${s.sex[0].toUpperCase()}${s.sex.slice(1)} · ${s.dob ?? "—"}`],
    ["Class", cls?.name ?? "⚠ not placed"],
    ["Admission no · date", `${s.admissionNo} · ${s.admittedOn ?? "today"}`],
    ["Attendance", s.boarding ? "Boarder" : "Day student"],
    ["Guardians", gs.length ? gs.map((g) => `${g.name} (${g.phone})`).join(", ") : "⚠ none linked"],
    ["Emergency", s.emergencyName ? `${s.emergencyName} · ${s.emergencyPhone ?? ""}` : "—"],
    ["Medical", s.medicalNotes ?? "—"],
    ["Payment arrangement", s.paymentNote ?? "—"],
  ];
  return (
    <div className="space-y-5">
      <Card>
        <h2 className="font-semibold">Review & complete</h2>
        <div className="mt-3 flex items-start gap-4">
          <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft text-xl font-semibold text-primary">
            {photoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={photoUrl} alt="" className="h-full w-full object-cover" />
              : `${s.firstName[0]}${s.lastName[0]}`}
          </span>
          <dl className="flex-1 space-y-1.5 text-sm">
            {rows.map(([l, v]) => (
              <div key={l} className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{l}</dt>
                <dd className={cn("text-right", v?.startsWith("⚠") && "text-warning")}>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="mt-4 border-t border-border pt-4">
          <PhotoUploader slug={slug} studentId={s.id} enabled={r2Enabled} />
        </div>
      </Card>
      <Card>
        <h2 className="font-semibold">Provisioning</h2>
        <form action={completeAdmission.bind(null, slug, s.id)} className="mt-3 space-y-2.5 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="raiseInvoice" defaultChecked /> Raise this term’s invoice from the class fee plan
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="issueLogin" /> Issue a student login now (credentials appear on the student file)
          </label>
          <div className="mt-2 flex items-center justify-between border-t border-border pt-4">
            <Link href={`?draft=${s.id}&step=6`} className={btnGhostCls}>Back</Link>
            <button className={btnCls}>Complete admission</button>
          </div>
        </form>
        <form action={discardAdmission.bind(null, slug, s.id)} className="mt-3 text-right">
          <button className="text-xs text-danger underline-offset-2 hover:underline">Discard this draft admission</button>
        </form>
      </Card>
    </div>
  );
}
