import Link from "next/link";
import { requireModule } from "@/core/school-context";
import {
  getStructure, SECTIONS, SECTION_LABELS, fmtMin, type Section,
} from "@/core/academics";
import { PageHeader, Card, Badge, Field, inputCls, btnCls, btnGhostCls } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";
import {
  setSectionMode, addSlot, saveSlot, deleteSlot, saveSectionSubjects, saveClassDeviation,
} from "./actions";

const ERR: Record<string, string> = {
  times: "The end time must come after the start time.",
};
const KINDS = ["teaching", "assembly", "break", "lunch"] as const;
const t2v = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** ONE home for how each section's school day works: teaching mode, the day
 *  skeleton every timetable renders from, and the subject set every class in
 *  the section inherits (with per-class deviations as the exception). */
export default async function DayPlanSettings({ params, searchParams }: {
  params: Promise<{ school: string }>;
  searchParams: Promise<{ s?: string; cls?: string; err?: string }>;
}) {
  const { school: slug } = await params;
  const sp = await searchParams;
  const { school } = await requireModule(slug, "timetable", ["admin"]);
  const S = await getStructure(school.id);

  const section = (SECTIONS.includes(sp.s as Section) ? sp.s : "primary") as Section;
  const mode = S.modeBySection.get(section) ?? "subject_teaching";
  const slots = S.slotsBySection(section);
  const secSubjectIds = new Set(S.subsBySection.get(section) ?? []);
  const sectionClasses = S.classes
    .filter((c) => S.sectionOfClass(c) === section)
    .sort((a, b) => a.name.localeCompare(b.name));
  const openCls = sectionClasses.find((c) => c.id === sp.cls);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Day plan & subjects"
        sub="Configured once per section — every timetable, score sheet and allocation reads from here." />

      {sp.err && ERR[sp.err] && (
        <p className="mb-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{ERR[sp.err]}</p>
      )}

      <div className="mb-5 flex gap-2">
        {SECTIONS.map((s) => (
          <Link key={s} href={`?s=${s}`}
            className={`rounded-md border px-3.5 py-1.5 text-sm font-medium ${s === section
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border hover:bg-muted"}`}>
            {SECTION_LABELS[s]}
          </Link>
        ))}
      </div>

      {/* ── teaching mode ── */}
      <Card className="mb-5">
        <h2 className="font-semibold">How {SECTION_LABELS[section]} is taught</h2>
        <form action={setSectionMode.bind(null, slug)} className="mt-3 space-y-2.5">
          <input type="hidden" name="section" value={section} />
          <label className="flex items-start gap-2.5 text-sm">
            <input type="radio" name="mode" value="class_teacher" defaultChecked={mode === "class_teacher"} className="mt-0.5" />
            <span><b>Class teacher</b> — one teacher owns the whole class&apos;s week. No subject
              teachers walk in; the class teacher is automatically the teacher for every lesson.</span>
          </label>
          <label className="flex items-start gap-2.5 text-sm">
            <input type="radio" name="mode" value="subject_teaching" defaultChecked={mode === "subject_teaching"} className="mt-0.5" />
            <span><b>Subject teaching</b> — subject teachers rotate between classes. Who teaches
              what comes from <Link href="/staff/allocations" className="text-primary">Teaching &amp; allocations</Link>.</span>
          </label>
          <SubmitButton className={btnCls} pendingText="Saving…">Save mode</SubmitButton>
        </form>
      </Card>

      {/* ── day skeleton ── */}
      <Card className="mb-5">
        <h2 className="font-semibold">The {SECTION_LABELS[section]} school day</h2>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Assembly, periods, breaks and lunch — the columns of every {SECTION_LABELS[section]} timetable.
          Removing a period also clears any lessons placed in it.
        </p>
        <div className="mt-3 space-y-2">
          {slots.map((sl) => (
            <form key={sl.id} action={saveSlot.bind(null, slug, sl.id)}
              className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
              <input type="hidden" name="section" value={section} />
              <input name="name" defaultValue={sl.name} className={inputCls + " w-36"} />
              <select name="kind" defaultValue={sl.kind} className={inputCls + " w-28"}>
                {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              <input name="start" type="time" defaultValue={t2v(sl.startMin)} className={inputCls + " w-28"} />
              <span className="text-muted-foreground">–</span>
              <input name="end" type="time" defaultValue={t2v(sl.endMin)} className={inputCls + " w-28"} />
              <SubmitButton className={btnGhostCls + " px-2.5 py-1.5 text-[12.5px]"} pendingText="…">Save</SubmitButton>
              <SubmitButton formAction={deleteSlot.bind(null, slug, sl.id, section)}
                className="rounded-md px-2 py-1.5 text-[12.5px] text-danger hover:bg-danger/10" pendingText="…">
                Remove
              </SubmitButton>
            </form>
          ))}
        </div>
        <form action={addSlot.bind(null, slug)} className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
          <input type="hidden" name="section" value={section} />
          <Field label="Name"><input name="name" placeholder="Period 8" required className={inputCls + " w-36"} /></Field>
          <Field label="Kind">
            <select name="kind" className={inputCls + " w-28"}>
              {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </Field>
          <Field label="Start"><input name="start" type="time" required className={inputCls + " w-28"} /></Field>
          <Field label="End"><input name="end" type="time" required className={inputCls + " w-28"} /></Field>
          <SubmitButton className={btnCls} pendingText="Adding…">Add slot</SubmitButton>
        </form>
      </Card>

      {/* ── section subject set ── */}
      <Card className="mb-5">
        <h2 className="font-semibold">{SECTION_LABELS[section]} subjects</h2>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Every class in {SECTION_LABELS[section]} inherits this list — score sheets, allocations and the
          timetable all follow it. The catalogue itself is managed under{" "}
          <Link href="/settings" className="text-primary">Settings → Subjects</Link>.
        </p>
        <form action={saveSectionSubjects.bind(null, slug)} className="mt-3">
          <input type="hidden" name="section" value={section} />
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {S.subjects.map((s) => (
              <label key={s.id} className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-[13px]">
                <input type="checkbox" name="subjectId" value={s.id} defaultChecked={secSubjectIds.has(s.id)} />
                {s.name}
              </label>
            ))}
          </div>
          <SubmitButton className={btnCls + " mt-3"} pendingText="Saving…">Save subjects</SubmitButton>
        </form>
      </Card>

      {/* ── per-class deviations ── */}
      <Card>
        <h2 className="font-semibold">Classes in {SECTION_LABELS[section]}</h2>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Classes inherit the section list. Open one only when it genuinely differs.
        </p>
        <ul className="mt-3 divide-y divide-border text-sm">
          {sectionClasses.map((c) => {
            const eff = S.effectiveSubjectIds(c.id);
            const deviates = S.overrides.some((o) => o.classId === c.id);
            return (
              <li key={c.id} className="py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{c.name}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-[12px] text-muted-foreground" data-nums="">{eff.length} subjects</span>
                    {deviates && <Badge tone="warning">deviates</Badge>}
                    <Link href={`?s=${section}&cls=${c.id}`} className="text-[12.5px] font-medium text-primary">
                      {openCls?.id === c.id ? "editing…" : "Adjust"}
                    </Link>
                  </span>
                </div>
                {openCls?.id === c.id && (
                  <form action={saveClassDeviation.bind(null, slug, c.id)}
                    className="mt-2 rounded-md border border-border p-3">
                    <p className="mb-2 text-[12px] text-muted-foreground">
                      Tick exactly what <b>{c.name}</b> studies — only the difference from the
                      {" "}{SECTION_LABELS[section]} list is stored.
                    </p>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                      {S.subjects.map((s) => (
                        <label key={s.id} className="flex items-center gap-2 text-[13px]">
                          <input type="checkbox" name="subjectId" value={s.id}
                            defaultChecked={eff.includes(s.id)} />
                          {s.name}
                        </label>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <SubmitButton className={btnCls} pendingText="Saving…">Save {c.name}</SubmitButton>
                      <Link href={`?s=${section}`} className={btnGhostCls}>Close</Link>
                    </div>
                  </form>
                )}
              </li>
            );
          })}
          {sectionClasses.length === 0 && (
            <li className="py-2 text-muted-foreground">No classes in this section yet.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
