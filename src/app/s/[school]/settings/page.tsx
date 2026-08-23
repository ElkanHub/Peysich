import { eq, and, sql } from "drizzle-orm";
import { ChevronDown } from "lucide-react";
import { db } from "@/db";
import {
  academicYears, terms, levels, classes, subjects, staff, gradingSchemes, rooms,
  students, enrollments, teachingAssignments, assessments,
} from "@/db/schema";
import { requireSchool, getCurrentTerm } from "@/core/school-context";
import { termWeeks, getSchoolHours } from "@/core/calendar";
import { LEVEL_TEMPLATE } from "@/lib/levels";
import { createYear, setupLevels, addClass, saveBranding } from "../actions";
import { addRoom, deleteRoom, setClassRoom } from "../actions-rooms";
import {
  addSubject, renameSubject, deleteSubject, addLevel, updateLevel, deleteLevel,
  renameClass, deleteClass, updateRoom,
} from "./structure-actions";
import { updateTermDates, saveSchoolHours } from "./calendar-actions";
import { Field, PageHeader, Badge, inputCls, btnCls, btnGhostCls } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";
import { GradingEditor } from "./grading";
import { LogoUploader } from "./logo";
import { r2Enabled, presignDownload } from "@/lib/r2";

const ERR: Record<string, string> = {
  subjinuse: "That subject is in use — expand its row, review what will be removed, and tick the confirmation to delete it.",
  levelhasclasses: "That level still has classes under it — remove or move the classes first.",
  levelhasfees: "That level has fee items attached — remove them under Fees first.",
  classinuse: "That class holds students or enrolment history and cannot be removed — history backs report cards and certificates. Move the students and it stays as an empty record, or rename it instead.",
  termdates: "A term has to end after it starts — please check the two dates.",
  termoverlap: "Those dates sit on top of another term in the same year — terms can't overlap.",
  hours: "Closing time has to come after opening time.",
};

/** Preschool / Primary / JHS grouping for the GES ladder; customs follow
 *  their preschool flag. */
function groupOf(l: { code: string; preschool: boolean }) {
  if (/^(creche|nursery|kg)/.test(l.code)) return "Preschool";
  if (/^b[1-6]$/.test(l.code)) return "Primary";
  if (/^b[7-9]$/.test(l.code)) return "Junior High";
  return l.preschool ? "Preschool" : "Other";
}
const ROOM_KINDS = [["classroom", "Classroom"], ["science_lab", "Science lab"], ["ict_lab", "ICT lab"],
  ["library", "Library"], ["hall", "Hall"], ["office", "Office"], ["other", "Other"]] as const;

/** One accordion section: a named drawer that opens to its settings. */
function Section({ title, hint, children, defaultOpen, danger }: {
  title: string; hint: string; children: React.ReactNode; defaultOpen?: boolean; danger?: boolean;
}) {
  return (
    <details open={defaultOpen} className="group rounded-xl border border-border bg-card shadow-[var(--shadow-sm)]">
      <summary className="flex cursor-pointer select-none items-center justify-between gap-3 rounded-xl px-4 py-3.5 transition-colors hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className={`font-semibold ${danger ? "text-danger" : ""}`}>{title}</span>
          <span className="block text-[13.5px] text-muted-foreground">{hint}</span>
        </span>
        <ChevronDown size={16} className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-border px-4 pb-4 pt-4">{children}</div>
    </details>
  );
}

export default async function Settings({ params, searchParams }: {
  params: Promise<{ school: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  const { school: slug } = await params;
  const { err } = await searchParams;
  const { school } = await requireSchool(slug, ["admin"]);
  const [yrs, tms, lvs, cls, subs, tchs, rms, kidCounts, enrolCounts, allocCounts, sheetCounts] = await Promise.all([
    db.select().from(academicYears).where(eq(academicYears.schoolId, school.id)),
    db.select().from(terms).where(eq(terms.schoolId, school.id)),
    db.select().from(levels).where(eq(levels.schoolId, school.id)).orderBy(levels.sortOrder),
    db.select().from(classes).where(eq(classes.schoolId, school.id)),
    db.select().from(subjects).where(eq(subjects.schoolId, school.id)).orderBy(subjects.name),
    db.select().from(staff).where(eq(staff.schoolId, school.id)),
    db.select().from(rooms).where(eq(rooms.schoolId, school.id)).orderBy(rooms.name),
    db.select({ classId: students.classId, n: sql<number>`count(*)` }).from(students)
      .where(and(eq(students.schoolId, school.id), eq(students.status, "active")))
      .groupBy(students.classId),
    db.select({ classId: enrollments.classId, n: sql<number>`count(*)` }).from(enrollments)
      .where(eq(enrollments.schoolId, school.id)).groupBy(enrollments.classId),
    db.select({ subjectId: teachingAssignments.subjectId, n: sql<number>`count(*)` })
      .from(teachingAssignments).where(eq(teachingAssignments.schoolId, school.id))
      .groupBy(teachingAssignments.subjectId),
    db.select({ subjectId: assessments.subjectId, n: sql<number>`count(*)` })
      .from(assessments).where(eq(assessments.schoolId, school.id))
      .groupBy(assessments.subjectId),
  ]);
  const [scheme] = await db.select().from(gradingSchemes).where(eq(gradingSchemes.schoolId, school.id));
  const current = await getCurrentTerm(school.id);
  const hours = getSchoolHours(school.settings);
  const b = school.branding;
  const logoUrl = b.logoUrl && r2Enabled ? await presignDownload(b.logoUrl) : null;
  const kidsOf = new Map(kidCounts.map((c) => [c.classId, Number(c.n)]));
  const enrolsOf = new Map(enrolCounts.map((c) => [c.classId, Number(c.n)]));
  const allocsOf = new Map(allocCounts.map((c) => [c.subjectId, Number(c.n)]));
  const sheetsOf = new Map(sheetCounts.map((c) => [c.subjectId, Number(c.n)]));
  const usedCodes = new Set(lvs.map((l) => l.code));
  const templateLeft = LEVEL_TEMPLATE.filter(([code]) => !usedCodes.has(code));
  const groups = ["Preschool", "Primary", "Junior High", "Other"]
    .map((g) => ({ g, ls: lvs.filter((l) => groupOf(l) === g) }))
    .filter(({ ls }) => ls.length > 0);
  const today = new Date().toISOString().slice(0, 10);
  const yearsSorted = [...yrs].sort((a, c) => c.startsAt.localeCompare(a.startsAt));

  return (
    <div className="max-w-3xl space-y-3">
      <PageHeader title="School Settings" sub="Every section opens on its own — find what you need, change it, close it" />

      {err && ERR[err] && (
        <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{ERR[err]}</p>
      )}

      {/* ── 1 · academic calendar ── */}
      <Section title="Academic calendar" defaultOpen={!current}
        hint="Years, terms and their start/end dates — the active term, week numbers and registers follow these">
        {yearsSorted.map((y) => (
          <div key={y.id} className="mb-4">
            <p className="text-sm font-medium">{y.name}
              {y.isCurrent && <span className="ml-2 text-[13px] font-normal text-success">current year</span>}
            </p>
            <div className="mt-2 space-y-2">
              {tms.filter((t) => t.yearId === y.id)
                .sort((a, c) => a.startsAt.localeCompare(c.startsAt))
                .map((t) => {
                  const weeks = termWeeks(t).length;
                  const status = current?.id === t.id ? "active"
                    : t.endsAt < today ? "past" : t.startsAt > today ? "upcoming" : "open";
                  return (
                    <form key={t.id} action={updateTermDates.bind(null, slug, t.id)}
                      className="flex flex-wrap items-end gap-2 rounded-lg border border-border px-3 py-2.5">
                      <span className="w-20 pb-2 text-sm font-medium">{t.name}</span>
                      <Field label="First day">
                        <input name="startsAt" type="date" defaultValue={t.startsAt} required className={inputCls} />
                      </Field>
                      <Field label="Last day">
                        <input name="endsAt" type="date" defaultValue={t.endsAt} required className={inputCls} />
                      </Field>
                      <span className="pb-2.5 text-[13px] text-muted-foreground" data-nums="">{weeks} weeks</span>
                      <span className="pb-2">
                        {status === "active" && <Badge tone="success">active now</Badge>}
                        {status === "past" && <Badge tone="default">ended</Badge>}
                        {status === "upcoming" && <Badge tone="warning">upcoming</Badge>}
                      </span>
                      <SubmitButton className={btnGhostCls + " ml-auto"} pendingText="Saving…">Save dates</SubmitButton>
                    </form>
                  );
                })}
            </div>
          </div>
        ))}
        <p className="mb-4 text-[13.5px] text-muted-foreground">
          The <b>active term</b> follows today&apos;s date automatically — when {current ? `${current.name} ends` : "a term ends"},
          the next one takes over on its first day. No switch to remember.
        </p>
        <form action={createYear.bind(null, slug)} className="grid grid-cols-3 gap-3 border-t border-border pt-4">
          <Field label="New year name"><input name="name" placeholder="2027/2028" required className={inputCls} /></Field>
          <Field label="Starts"><input name="startsAt" type="date" required className={inputCls} /></Field>
          <Field label="Ends"><input name="endsAt" type="date" required className={inputCls} /></Field>
          <SubmitButton className={btnCls + " col-span-3"}>Create year (3 terms auto-created — adjust their dates above)</SubmitButton>
        </form>
      </Section>

      {/* ── 2 · school hours ── */}
      <Section title="School hours"
        hint={`The school day runs ${hours.open}–${hours.close} — dashboards count down to closing from this`}>
        <form action={saveSchoolHours.bind(null, slug)} className="flex flex-wrap items-end gap-3">
          <Field label="Doors open"><input name="open" type="time" defaultValue={hours.open} required className={inputCls} /></Field>
          <Field label="School closes"><input name="close" type="time" defaultValue={hours.close} required className={inputCls} /></Field>
          <SubmitButton className={btnCls} pendingText="Saving…">Save hours</SubmitButton>
        </form>
        <p className="mt-2 text-[13.5px] text-muted-foreground">
          School days are Monday to Friday — weekends never count in attendance or any student records.
          Mark holidays on the <a href="/calendar" className="font-medium text-primary">Calendar</a>.
        </p>
      </Section>

      {/* ── 3 · structure: levels & classes ── */}
      <Section title="Structure — levels & classes"
        hint="The GES ladder your school runs, each level's classes, class teachers and rooms">
        <p className="mb-3 text-[14px] text-muted-foreground">
          Renames reflect everywhere instantly; removals are blocked while history depends on them.
        </p>
        {lvs.length === 0 ? (
          <form action={setupLevels.bind(null, slug)}>
            <p className="text-sm text-muted-foreground">Tick the levels your school runs — one class per level and the standard subject list are created for you.</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
              {LEVEL_TEMPLATE.map(([code, name]) => (
                <label key={code} className="flex items-center gap-2">
                  <input type="checkbox" name={`lv_${code}`} defaultChecked /> {name}
                </label>
              ))}
            </div>
            <SubmitButton className={btnCls + " mt-4"}>Create structure</SubmitButton>
          </form>
        ) : (
          <div className="space-y-5">
            {groups.map(({ g, ls }) => (
              <div key={g}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g}</p>
                <div className="mt-1.5 space-y-3">
                  {ls.map((l) => {
                    const myClasses = cls.filter((c) => c.levelId === l.id);
                    return (
                      <div key={l.id} className="rounded-lg border border-border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <form action={updateLevel.bind(null, slug, l.id)} className="flex flex-wrap items-center gap-2">
                            <input name="name" defaultValue={l.name}
                              className="w-36 rounded-md border border-border px-2 py-1 text-sm font-medium" />
                            <label className="flex items-center gap-1.5 text-[13px] text-muted-foreground"
                              title="Preschool levels use skills-based report cards instead of scored subjects">
                              <input type="checkbox" name="preschool" defaultChecked={l.preschool} /> skills-based reports
                            </label>
                            <SubmitButton className="rounded border border-border px-2 py-1 text-xs hover:bg-muted">Save</SubmitButton>
                          </form>
                          {myClasses.length === 0 ? (
                            <form action={deleteLevel.bind(null, slug, l.id)}>
                              <SubmitButton className="rounded border border-border px-2 py-1 text-xs text-danger hover:bg-muted">
                                Remove level
                              </SubmitButton>
                            </form>
                          ) : (
                            <span className="text-[12.5px] text-muted-foreground">{myClasses.length} class{myClasses.length > 1 ? "es" : ""}</span>
                          )}
                        </div>
                        <div className="mt-2 space-y-1.5">
                          {myClasses.map((c) => {
                            const kids = kidsOf.get(c.id) ?? 0;
                            const enrols = enrolsOf.get(c.id) ?? 0;
                            const removable = kids === 0 && enrols === 0;
                            return (
                              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-2.5 py-1.5">
                                <form action={renameClass.bind(null, slug, c.id)} className="flex items-center gap-1.5">
                                  <input name="name" defaultValue={c.name}
                                    className="w-32 rounded-md border border-border px-2 py-1 text-xs" />
                                  <SubmitButton className="rounded border border-border px-2 py-1 text-[12px] hover:bg-muted">Rename</SubmitButton>
                                </form>
                                <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
                                  <span data-nums="">{kids} students</span>
                                  <span>{tchs.find((t) => t.id === c.classTeacherId)?.name ?? "no class teacher"}</span>
                                  <form action={setClassRoom.bind(null, slug, c.id)} className="flex items-center gap-1">
                                    <select name="roomId" defaultValue={c.roomId ?? ""}
                                      className="rounded-md border border-border px-1.5 py-0.5 text-[12px]">
                                      <option value="">no room</option>
                                      {rms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                                    </select>
                                    <SubmitButton className="rounded border border-border px-1.5 py-0.5 text-[12px] hover:bg-muted">Set</SubmitButton>
                                  </form>
                                  {removable ? (
                                    <form action={deleteClass.bind(null, slug, c.id)}>
                                      <SubmitButton className="rounded border border-border px-1.5 py-0.5 text-[12px] text-danger hover:bg-muted">Remove</SubmitButton>
                                    </form>
                                  ) : (
                                    <span title={`${enrols} enrolment records protect this class's history`}
                                      className="cursor-help text-[12px] text-faint">protected</span>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                          <form action={addClass.bind(null, slug)} className="flex items-center gap-1.5 pl-2.5">
                            <input type="hidden" name="levelId" value={l.id} />
                            <input name="name" placeholder={`${l.name} B`} required
                              className="w-32 rounded-md border border-dashed border-border px-2 py-1 text-xs" />
                            <SubmitButton className="rounded border border-border px-2 py-1 text-[12px] hover:bg-muted">+ Add class</SubmitButton>
                          </form>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <form action={addLevel.bind(null, slug)} className="grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-4">
              <Field label="New level name">
                <input name="name" required list="level-suggestions" placeholder="Basic 7 (B7)" className={inputCls} />
                <datalist id="level-suggestions">
                  {templateLeft.map(([code, name]) => <option key={code} value={name} />)}
                </datalist>
              </Field>
              <Field label="Position after">
                <select name="afterId" className={inputCls}>
                  <option value="">At the top</option>
                  {lvs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </Field>
              <Field label="Report style">
                <label className="flex h-10 items-center gap-2 text-sm">
                  <input type="checkbox" name="preschool" /> Skills-based (preschool)
                </label>
              </Field>
              <div className="flex items-end">
                <SubmitButton className={btnGhostCls + " w-full"}>Add level</SubmitButton>
              </div>
            </form>
          </div>
        )}
      </Section>

      {/* ── 4 · subjects ── */}
      <Section title="Subjects"
        hint="The curriculum catalogue — renames flow into score sheets, allocations and the timetable">
        <ul className="divide-y divide-border">
          {subs.map((sub) => {
            const allocs = allocsOf.get(sub.id) ?? 0;
            const sheets = sheetsOf.get(sub.id) ?? 0;
            const used = allocs + sheets > 0;
            return (
              <li key={sub.id} className="py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <form action={renameSubject.bind(null, slug, sub.id)} className="flex items-center gap-1.5">
                    <input name="name" defaultValue={sub.name}
                      className="w-52 rounded-md border border-border px-2 py-1 text-sm" />
                    <SubmitButton className="rounded border border-border px-2 py-1 text-xs hover:bg-muted">Rename</SubmitButton>
                  </form>
                  <span className="flex items-center gap-2">
                    <span className="text-[13px] text-muted-foreground" data-nums="">
                      {allocs} allocation{allocs === 1 ? "" : "s"} · {sheets} score sheet{sheets === 1 ? "" : "s"}
                    </span>
                    {used
                      ? <Badge tone="warning">in use</Badge>
                      : (
                        <form action={deleteSubject.bind(null, slug, sub.id)}>
                          <SubmitButton className="rounded border border-border px-2 py-1 text-xs text-danger hover:bg-muted">Remove</SubmitButton>
                        </form>
                      )}
                  </span>
                </div>
                {used && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-[13px] text-danger">Remove anyway…</summary>
                    <form action={deleteSubject.bind(null, slug, sub.id)}
                      className="mt-1.5 flex flex-wrap items-center gap-2 rounded-md bg-danger/5 px-3 py-2 text-[13.5px]">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" name="confirm" />
                        Delete {sub.name}: its {allocs ? `${allocs} teacher allocation${allocs > 1 ? "s" : ""}` : ""}
                        {allocs && sheets ? " and " : ""}{sheets ? `${sheets} score sheet${sheets > 1 ? "s" : ""} (with entered marks)` : ""} go too.
                        Published report cards keep it.
                      </label>
                      <SubmitButton className="rounded border border-danger/40 px-2 py-1 text-[12.5px] text-danger hover:bg-danger/10">
                        Delete subject
                      </SubmitButton>
                    </form>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
        <form action={addSubject.bind(null, slug)} className="mt-3 flex items-end gap-2 border-t border-border pt-3">
          <Field label="New subject"><input name="name" required placeholder="French" className={inputCls} /></Field>
          <SubmitButton className={btnGhostCls}>Add subject</SubmitButton>
        </form>
        <p className="mt-3">
          <a href="/staff/allocations" className="text-[14px] font-medium text-primary">
            Assign class teachers & subject teachers → Teaching &amp; allocations
          </a>
        </p>
      </Section>

      {/* ── 5 · day plan ── */}
      <Section title="Day plan & timetable"
        hint="Per section: teaching mode, the school day's periods and breaks, and section subjects">
        <p className="text-sm text-muted-foreground">
          Per section (Preschool · Primary · JHS): class-teacher vs subject-teaching mode, the
          school day&apos;s skeleton — assembly, periods, breaks, lunch — and which subjects the
          section takes. Every timetable, score sheet and allocation grid reads from here.
        </p>
        <a href="/settings/timetable" className={btnCls + " mt-3 inline-block"}>Open day plan</a>
      </Section>

      {/* ── 6 · assessment scheme ── */}
      <Section title="Assessment scheme"
        hint="Name your class tests, set weights to 100, or shape the preschool skills list">
        <p className="text-sm text-muted-foreground">
          Per section: name your class tests and set their weights (they must total 100 with
          the exam), or configure the preschool skills list and its rating scale. Score
          sheets, publishing and report cards all follow this.
        </p>
        <a href="/settings/assessment" className={btnCls + " mt-3 inline-block"}>Open assessment scheme</a>
      </Section>

      {/* ── 7 · rooms ── */}
      <Section title="Rooms & facilities"
        hint="Classrooms, labs and halls — seat counts feed enrolment capacity">
        {rms.length > 0 && (
          <ul className="space-y-2">
            {rms.map((r) => (
              <li key={r.id} className="rounded-md border border-border px-3 py-2">
                <form action={updateRoom.bind(null, slug, r.id)}
                  className="grid grid-cols-2 items-end gap-2 sm:grid-cols-5">
                  <Field label="Name"><input name="name" defaultValue={r.name} className={inputCls} /></Field>
                  <Field label="Type">
                    <select name="kind" defaultValue={r.kind} className={inputCls}>
                      {ROOM_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </Field>
                  <Field label="Seats"><input name="capacity" type="number" min={1} defaultValue={r.capacity ?? ""} className={inputCls} /></Field>
                  <Field label="Amenities / notes"><input name="notes" defaultValue={r.notes ?? ""} placeholder="Projector, 20 PCs" className={inputCls} /></Field>
                  <div className="flex gap-1.5">
                    <SubmitButton className={btnGhostCls + " flex-1"} pendingText="Saving…">Save</SubmitButton>
                  </div>
                </form>
                <form action={deleteRoom.bind(null, slug, r.id)} className="mt-1 text-right">
                  <SubmitButton className="text-[12.5px] text-danger underline-offset-2 hover:underline">Remove room</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={addRoom.bind(null, slug)} className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-4">
          <Field label="Room name"><input name="name" required placeholder="Science Lab" className={inputCls} /></Field>
          <Field label="Type">
            <select name="kind" className={inputCls}>
              {ROOM_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Seats"><input name="capacity" type="number" min={1} placeholder="35" className={inputCls} /></Field>
          <Field label="Amenities / notes"><input name="notes" placeholder="Block B, upstairs" className={inputCls} /></Field>
          <SubmitButton className={btnGhostCls + " col-span-2 sm:col-span-4"}>Add room</SubmitButton>
        </form>
      </Section>

      {/* ── 8 · grading ── */}
      <Section title="Grading scale"
        hint="CA/exam split and the grade bands printed on report cards">
        <GradingEditor slug={slug}
          caWeight={scheme?.caWeight ?? 50} examWeight={scheme?.examWeight ?? 50}
          bands={scheme?.bands ?? [
            { min: 80, grade: "1", remark: "Excellent" }, { min: 70, grade: "2", remark: "Very Good" },
            { min: 60, grade: "3", remark: "Good" }, { min: 55, grade: "4", remark: "Credit" },
            { min: 50, grade: "5", remark: "Average" }, { min: 40, grade: "6", remark: "Below Average" },
            { min: 35, grade: "7", remark: "Pass" }, { min: 30, grade: "8", remark: "Weak Pass" },
            { min: 0, grade: "9", remark: "Fail" }]} />
      </Section>

      {/* ── 9 · branding ── */}
      <Section title="Branding & identity"
        hint="Logo, colours, motto and contact lines — on reports, invoices, emails and SMS">
        <form action={saveBranding.bind(null, slug)} className="grid grid-cols-2 gap-3">
          <Field label="Motto"><input name="motto" defaultValue={b.motto} className={inputCls} /></Field>
          <Field label="Primary color (reports & certificates)">
            <input name="primaryColor" type="color" defaultValue={b.primaryColor || "#5E1D3E"}
              className="h-10 w-20 cursor-pointer rounded-md border border-border bg-card p-1" />
          </Field>
          <Field label="Address"><input name="address" defaultValue={b.address} className={inputCls} /></Field>
          <Field label="Phone"><input name="phone" defaultValue={b.phone} className={inputCls} /></Field>
          <Field label="Email"><input name="email" defaultValue={b.email} className={inputCls} /></Field>
          <Field label="SMS sender ID"><input name="smsSenderId" defaultValue={b.smsSenderId} maxLength={11} className={inputCls} /></Field>
          <SubmitButton className={btnCls + " col-span-2"} pendingText="Saving…">Save branding</SubmitButton>
        </form>
        <div className="mt-4"><LogoUploader slug={slug} enabled={r2Enabled} currentUrl={logoUrl} /></div>
      </Section>

      {/* ── 10 · year end ── */}
      <Section danger title="Year end — promotion"
        hint="Move every class up, handle repeaters, graduate the top level, open the new year">
        <p className="text-sm text-muted-foreground">
          Guided promotion: choose each class&apos;s destination, tick the students repeating,
          graduate the top level, and open the new academic year — in one pass.
        </p>
        <a href="/settings/promotion" className={btnCls + " mt-3 inline-block bg-danger"}>Start year-end promotion</a>
      </Section>
    </div>
  );
}
