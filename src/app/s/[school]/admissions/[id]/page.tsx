import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { applicants, applicantNotes, levels } from "@/db/schema";
import { requireModule } from "@/core/school-context";
import { getIntakeConfig, parseDocs, STAGE_LABEL } from "@/modules/admissions/config";
import { Card, Field, PageHeader, inputCls, btnCls, btnGhostCls } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";
import {
  updateApplicant, moveStage, saveScreening, toggleDoc, makeOffer,
  resendOfferSms, admitApplicant, addNote,
} from "../actions";

const STEPS = ["new", "screening", "offer", "admitted"];

/** The applicant file — everything before they are a student. The left
 *  side is the record; the decision rail on the right is the only place
 *  with buttons. */
export default async function ApplicantFile({ params }: {
  params: Promise<{ school: string; id: string }>;
}) {
  const { school: slug, id } = await params;
  const { school } = await requireModule(slug, "admissions", ["admin"]);
  const [a] = await db.select().from(applicants)
    .where(and(eq(applicants.id, id), eq(applicants.schoolId, school.id)));
  if (!a) notFound();
  const cfg = getIntakeConfig(school.settings);
  const [lvs, notes] = await Promise.all([
    db.select().from(levels).where(eq(levels.schoolId, school.id)).orderBy(levels.sortOrder),
    db.select().from(applicantNotes).where(eq(applicantNotes.applicantId, a.id))
      .orderBy(desc(applicantNotes.createdAt)).limit(20),
  ]);
  const got = parseDocs(a.docs);
  const stepIdx = STEPS.indexOf(a.status);
  const decided = ["admitted", "rejected", "waitlist"].includes(a.status);
  const age = a.dob ? Math.floor((Date.now() - Date.parse(a.dob)) / (365.25 * 86400000)) : null;
  const initials = a.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("");

  return (
    <div className="max-w-4xl">
      <PageHeader title={a.name}
        sub={`Applying for ${lvs.find((l) => l.id === a.levelId)?.name ?? "—"} · added ${a.createdAt.toISOString().slice(0, 10)}`} />
      <p className="-mt-3 mb-4">
        <Link href="/admissions" className="text-[13.5px] font-medium text-primary">← Admissions desk</Link>
      </p>

      {/* stage stepper */}
      <div className="mb-5 flex overflow-hidden rounded-lg text-[11px] font-bold tracking-wide">
        {STEPS.map((s, i) => (
          <span key={s} className={`flex-1 border-r-2 border-background py-2 text-center uppercase last:border-r-0 ${
            a.status === s ? "bg-primary text-primary-foreground"
              : stepIdx > i || a.status === "admitted" ? "bg-brand-soft text-primary"
                : decided && stepIdx === -1 ? "bg-muted text-faint" : "bg-muted text-faint"}`}>
            {STAGE_LABEL[s]}
          </span>
        ))}
      </div>
      {a.status === "waitlist" && (
        <p className="mb-4 rounded-md bg-warning-soft px-3 py-2 text-sm">
          <b>Waitlisted.</b> {a.decisionReason ? `Reason: ${a.decisionReason}. ` : ""}Move them back into the pipeline any time from the decision rail.
        </p>
      )}
      {a.status === "rejected" && (
        <p className="mb-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          <b>Rejected</b>{a.decisionReason ? ` — ${a.decisionReason}` : ""}{a.decidedAt ? ` · ${a.decidedAt.toISOString().slice(0, 10)}` : ""}.
        </p>
      )}

      <div className="grid items-start gap-4 md:grid-cols-2">
        {/* ── the record ── */}
        <div className="space-y-4">
          <Card>
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[14px] font-bold uppercase text-primary">
                {initials}
              </span>
              <div>
                <p className="font-semibold leading-tight">{a.name}</p>
                <p className="text-[12.5px] text-muted-foreground">
                  {a.dob ? `${a.dob}${age !== null ? ` (${age} yrs)` : ""}` : "DOB not recorded"} · {a.sex ?? "sex not recorded"}
                </p>
              </div>
            </div>
            <details>
              <summary className="cursor-pointer text-[13px] font-medium text-primary">Edit details</summary>
              <form action={updateApplicant.bind(null, slug, a.id)} className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Full name"><input name="name" defaultValue={a.name} required className={inputCls} /></Field>
                <Field label="Level applying for">
                  <select name="levelId" defaultValue={a.levelId} className={inputCls}>
                    {lvs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </Field>
                <Field label="Date of birth"><input name="dob" type="date" defaultValue={a.dob ?? ""} className={inputCls} /></Field>
                <Field label="Sex">
                  <select name="sex" defaultValue={a.sex ?? ""} className={inputCls}>
                    <option value="">—</option><option value="female">Female</option><option value="male">Male</option>
                  </select>
                </Field>
                <Field label="Guardian name"><input name="guardianName" defaultValue={a.guardianName ?? ""} className={inputCls} /></Field>
                <Field label="Guardian phone"><input name="guardianPhone" defaultValue={a.guardianPhone} required className={inputCls} /></Field>
                <Field label="Previous school"><input name="prevSchool" defaultValue={a.prevSchool ?? ""} className={inputCls} /></Field>
                <Field label="How they heard"><input name="source" defaultValue={a.source ?? ""} className={inputCls} /></Field>
                <SubmitButton className={btnCls + " sm:col-span-2"} pendingText="Saving…">Save details</SubmitButton>
              </form>
            </details>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
              <dt className="text-muted-foreground">Guardian</dt>
              <dd className="font-medium">{a.guardianName ?? "—"} · <span data-nums="">{a.guardianPhone}</span></dd>
              <dt className="text-muted-foreground">Previous school</dt><dd>{a.prevSchool ?? "—"}</dd>
              <dt className="text-muted-foreground">How they heard</dt><dd>{a.source ?? "—"}</dd>
            </dl>
          </Card>

          <Card>
            <h2 className="font-semibold">Documents <span className="text-[12px] font-normal text-muted-foreground">from Intake settings</span></h2>
            <ul className="mt-2 divide-y divide-border text-[13.5px]">
              {cfg.docs.map((d) => (
                <li key={d.key} className="flex items-center justify-between py-1.5">
                  <span>{d.label} <span className="text-[11.5px] text-faint">· {d.note}</span></span>
                  <form action={toggleDoc.bind(null, slug, a.id, d.key)}>
                    <SubmitButton className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${got[d.key]
                      ? "bg-success/10 text-success" : "bg-danger/10 text-danger hover:bg-danger/20"}`}
                      pendingText="…">
                      {got[d.key] ? "received ✓" : "missing — mark received"}
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h2 className="font-semibold">Notes</h2>
            <form action={addNote.bind(null, slug, a.id)} className="mt-2 flex gap-2">
              <input name="body" placeholder="e.g. mother asked about the bus route" required
                className={inputCls + " flex-1"} />
              <SubmitButton className={btnGhostCls} pendingText="…">Add</SubmitButton>
            </form>
            <ul className="mt-3 space-y-2 border-l-2 border-border pl-3 text-[13px]">
              {notes.map((n) => (
                <li key={n.id}>
                  <p className="font-medium">{n.body}</p>
                  <p className="text-[11.5px] text-faint" data-nums="">
                    {n.createdAt.toISOString().slice(0, 10)} · {n.byName}
                  </p>
                </li>
              ))}
              {notes.length === 0 && <li className="text-muted-foreground">Nothing noted yet.</li>}
            </ul>
          </Card>
        </div>

        {/* ── screening + decision rail ── */}
        <div className="space-y-4">
          <Card>
            <h2 className="font-semibold">Screening</h2>
            <form action={saveScreening.bind(null, slug, a.id)} className="mt-2 grid gap-3 sm:grid-cols-2">
              <Field label="Interview date">
                <input name="interviewAt" type="date" defaultValue={a.interviewAt ?? ""} className={inputCls} />
              </Field>
              <Field label={`Entrance test (out of ${cfg.testMax})`}>
                <input name="testScore" type="number" min={0} max={cfg.testMax}
                  defaultValue={a.testScore ?? ""} className={inputCls} />
              </Field>
              <SubmitButton className={btnGhostCls + " sm:col-span-2"} pendingText="Saving…">
                Save screening
              </SubmitButton>
            </form>
            {a.testScore !== null && (
              <p className="mt-2 text-[12.5px]">
                {a.testScore >= cfg.testCutoff
                  ? <span className="font-medium text-success">Above the cut-off of {cfg.testCutoff} ✓</span>
                  : <span className="font-medium text-danger">Below the cut-off of {cfg.testCutoff}</span>}
              </p>
            )}
            <p className="mt-2 text-[12px] text-muted-foreground">
              Saving screening moves a New applicant into Screening automatically.
            </p>
          </Card>

          {a.status === "offer" && (
            <Card className="border-warning/50 bg-warning-soft">
              <h2 className="font-semibold">Offer out{a.offerDeadline ? ` — expires ${a.offerDeadline}` : ""}</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Sent {a.offerAt?.toISOString().slice(0, 10)} by SMS to {a.guardianPhone}. The guardian confirms
                at the office; then Admit below.
              </p>
              <form action={resendOfferSms.bind(null, slug, a.id)} className="mt-2">
                <SubmitButton className={btnGhostCls} pendingText="Sending…">Resend the SMS</SubmitButton>
              </form>
            </Card>
          )}
          {!decided && a.status !== "offer" && (
            <Card>
              <h2 className="font-semibold">Make an offer</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Sends an SMS to the guardian and moves the card to Offer.
              </p>
              <form action={makeOffer.bind(null, slug, a.id)} className="mt-2 flex flex-wrap items-end gap-2">
                <Field label="Accept by (optional)">
                  <input name="deadline" type="date" className={inputCls} />
                </Field>
                <SubmitButton className={btnCls} pendingText="Sending…">Send offer</SubmitButton>
              </form>
            </Card>
          )}

          <Card>
            <h2 className="font-semibold">Decision</h2>
            {a.status === "admitted" ? (
              <div className="mt-2 text-sm">
                <p className="font-medium text-success">Admitted ✓</p>
                {a.admittedStudentId && (
                  <Link href={`/students/${a.admittedStudentId}`}
                    className="mt-1 inline-block font-medium text-primary">Open the student file →</Link>
                )}
              </div>
            ) : (
              <div className="mt-2 flex flex-col gap-2">
                <form action={admitApplicant.bind(null, slug, a.id)}>
                  <SubmitButton className={btnCls + " w-full"} pendingText="Creating draft…">
                    Admit → create student file
                  </SubmitButton>
                </form>
                {a.status !== "waitlist" && (
                  <form action={moveStage.bind(null, slug, a.id, "waitlist")}>
                    <SubmitButton className={btnGhostCls + " w-full"} pendingText="…">Move to waitlist</SubmitButton>
                  </form>
                )}
                {a.status === "waitlist" && (
                  <form action={moveStage.bind(null, slug, a.id, "screening")}>
                    <SubmitButton className={btnGhostCls + " w-full"} pendingText="…">Back into screening</SubmitButton>
                  </form>
                )}
                {a.status !== "rejected" && (
                  <form action={moveStage.bind(null, slug, a.id, "rejected")} className="flex gap-2">
                    <input name="reason" placeholder="Reason (required for the record)" required
                      className={inputCls + " flex-1"} />
                    <SubmitButton className="rounded-md border border-danger/40 px-3 py-2 text-sm font-medium text-danger hover:bg-danger/10"
                      pendingText="…">
                      Reject
                    </SubmitButton>
                  </form>
                )}
              </div>
            )}
            <p className="mt-3 text-[12px] text-muted-foreground">
              Admit opens the Students form pre-filled (name, DOB, sex, guardian) as a draft — you review,
              pick the class, add the photo, finish. This card locks to Admitted and links to the student file forever.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
