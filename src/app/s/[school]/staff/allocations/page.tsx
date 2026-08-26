import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { staff, staffTeaching } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { getStructure, SECTION_LABELS } from "@/core/academics";
import { Card, PageHeader, Badge } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";
import { setAllocation, addTeachingRole, removeTeachingRole, clearMainClassTeacher, setFormMaster } from "../staff-actions";

/** TEACHING & ALLOCATIONS — profile-based. A teacher IS either a class
 *  teacher (main, with any number of assistants) or a subject teacher
 *  (subject + the levels they carry, main/assistant). Everything else —
 *  the timetable, score sheets, registers — is DERIVED from these
 *  profiles. Pins only break ties; nothing is repeated per class. */
export default async function Allocations({ params, searchParams }: {
  params: Promise<{ school: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  const { school: slug } = await params;
  const { err } = await searchParams;
  const { school } = await requireSchool(slug, ["admin"]);
  const S = await getStructure(school.id);
  const [teachers, profileRows] = await Promise.all([
    db.select().from(staff).where(and(
      eq(staff.schoolId, school.id), eq(staff.staffType, "teaching"), eq(staff.status, "active")))
      .orderBy(staff.name),
    db.select().from(staffTeaching).where(eq(staffTeaching.schoolId, school.id)),
  ]);
  const lvls = [...S.levels].sort((a, b) => a.sortOrder - b.sortOrder);
  const levelName = new Map(lvls.map((l) => [l.id, l.name]));
  const ordered = [...S.classes].sort((a, b) =>
    (S.levelById.get(a.levelId)?.sortOrder ?? 99) - (S.levelById.get(b.levelId)?.sortOrder ?? 99)
    || a.name.localeCompare(b.name));
  const teacherName = (id: string | null) => (id && S.staffById.get(id)?.name) || null;
  const parseLv = (raw: string | null) => {
    try { const a = JSON.parse(raw || "[]"); return Array.isArray(a) ? (a as string[]) : []; } catch { return []; }
  };

  // resolved periods/week per teacher (per-period overrides included)
  const periodsOf = new Map<string, number>();
  for (const e of S.entries) {
    const tid = S.teacherFor(e.classId, e.subjectId, e.teacherId);
    if (tid) periodsOf.set(tid, (periodsOf.get(tid) ?? 0) + 1);
  }
  const issues = S.allocationIssues();
  const pins = [...S.pins.entries()]; // [ "classId:subjectId", teacherId ]

  return (
    <div className="max-w-4xl">
      <PageHeader title="Teaching & allocations"
        sub="Assign each teacher ONCE — a class, or a subject with its levels. The timetable, registers and score sheets follow automatically." />
      {err === "roleform" && (
        <p className="mb-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          That role needs its details — a class for class roles; a subject plus at least one level for subject roles.
        </p>
      )}

      {/* ═══ 1 · teacher profiles ═══ */}
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Teacher profiles</h2>
      <div className="mb-6 space-y-2.5">
        {teachers.map((t) => {
          const mainOf = ordered.filter((c) => c.classTeacherId === t.id);
          const myRows = profileRows.filter((r) => r.staffId === t.id);
          const assistClasses = myRows.filter((r) => r.kind === "class");
          const subjectsMine = myRows.filter((r) => r.kind === "subject");
          const formOf = ordered.filter((c) => S.formMasterOf(c.id) === t.id);
          const empty = !mainOf.length && !assistClasses.length && !subjectsMine.length;
          return (
            <Card key={t.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">
                  <Link href={`/staff/${t.id}`} className="hover:text-primary">{t.name}</Link>
                  {formOf.length > 0 && (
                    <span className="ml-2 text-[12px] font-medium text-muted-foreground">
                      form master of {formOf.map((c) => c.name).join(", ")}
                    </span>
                  )}
                </p>
                <span className="text-[12.5px] text-muted-foreground" data-nums="">
                  {periodsOf.get(t.id) ?? 0} periods/wk
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {mainOf.map((c) => (
                  <form key={c.id} action={clearMainClassTeacher.bind(null, slug, c.id)}
                    className="flex items-center gap-1 rounded-full bg-brand-soft py-1 pl-3 pr-1.5 text-[12.5px] font-semibold text-primary">
                    Class teacher — {c.name}
                    <SubmitButton className="rounded-full px-1 leading-none hover:text-danger" pendingText="…">×</SubmitButton>
                  </form>
                ))}
                {assistClasses.map((r) => (
                  <form key={r.id} action={removeTeachingRole.bind(null, slug, r.id)}
                    className="flex items-center gap-1 rounded-full border border-border py-1 pl-3 pr-1.5 text-[12.5px] font-medium">
                    Assistant — {S.classById.get(r.classId ?? "")?.name ?? "?"}
                    <SubmitButton className="rounded-full px-1 leading-none text-muted-foreground hover:text-danger" pendingText="…">×</SubmitButton>
                  </form>
                ))}
                {subjectsMine.map((r) => (
                  <form key={r.id} action={removeTeachingRole.bind(null, slug, r.id)}
                    className={`flex items-center gap-1 rounded-full py-1 pl-3 pr-1.5 text-[12.5px] font-medium ${
                      r.role === "main" ? "bg-primary/10 text-primary" : "border border-border"}`}>
                    {S.subjectById.get(r.subjectId ?? "")?.name ?? "?"}
                    {r.role === "assistant" && <span className="opacity-70">(assistant)</span>}
                    <span className="font-normal text-muted-foreground">
                      · {parseLv(r.levelIds).map((id) => levelName.get(id)).filter(Boolean).join(", ") || "no levels"}
                    </span>
                    <SubmitButton className="rounded-full px-1 leading-none hover:text-danger" pendingText="…">×</SubmitButton>
                  </form>
                ))}
                {empty && <span className="text-[13px] text-muted-foreground">No teaching role yet — assign one below.</span>}
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-[13px] font-medium text-primary">Assign a role…</summary>
                <form action={addTeachingRole.bind(null, slug, t.id)}
                  className="mt-2 grid gap-2.5 rounded-md border border-border bg-muted/40 p-3 text-sm sm:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Role</span>
                    <select name="what" className="rounded-md border border-border bg-card px-2 py-1.5">
                      <option value="class-main">Class teacher (main — all subjects)</option>
                      <option value="class-assist">Class assistant</option>
                      <option value="subject">Subject teacher</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Class (for class roles)</span>
                    <select name="classId" className="rounded-md border border-border bg-card px-2 py-1.5">
                      <option value="">—</option>
                      {ordered.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Subject (for subject roles)</span>
                    <select name="subjectId" className="rounded-md border border-border bg-card px-2 py-1.5">
                      <option value="">—</option>
                      {[...S.subjects].sort((a, b) => a.name.localeCompare(b.name))
                        .map((s2) => <option key={s2.id} value={s2.id}>{s2.name}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">As</span>
                    <select name="role" className="rounded-md border border-border bg-card px-2 py-1.5">
                      <option value="main">Main teacher</option>
                      <option value="assistant">Assistant</option>
                    </select>
                  </label>
                  <fieldset className="sm:col-span-2">
                    <legend className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Levels the subject covers
                    </legend>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5">
                      {lvls.map((l) => (
                        <label key={l.id} className="flex items-center gap-1.5 text-[13px]">
                          <input type="checkbox" name="levelIds" value={l.id} className="h-3.5 w-3.5 accent-[var(--primary)]" />
                          {l.name}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <SubmitButton className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground sm:col-span-2"
                    pendingText="Saving…">
                    Add to {t.name.split(" ")[0]}&apos;s profile
                  </SubmitButton>
                </form>
              </details>
            </Card>
          );
        })}
        {teachers.length === 0 && (
          <Card><p className="text-sm text-muted-foreground">No active teaching staff yet — onboard teachers under Staff first.</p></Card>
        )}
      </div>

      {/* ═══ 2 · form masters ═══ */}
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Form masters</h2>
      <Card className="mb-6">
        <p className="mb-2 text-[13px] text-muted-foreground">
          The responsible teacher of each class — register, report cards, &quot;my class&quot;. Class-teaching
          classes default to their class teacher; subject-teaching classes appoint one.
        </p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {ordered.map((c) => {
            const mode = S.modeBySection.get(S.sectionOfClass(c));
            const derived = S.formMasterOf(c.id);
            const autoName = mode === "class_teacher" ? teacherName(c.classTeacherId) : null;
            return (
              <form key={c.id} action={setFormMaster.bind(null, slug, c.id)}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5">
                <span className="min-w-0 truncate text-sm font-medium">
                  {c.name}
                  <span className="ml-1.5 text-[11.5px] font-normal text-muted-foreground">
                    {mode === "class_teacher" ? "class-teaching" : "subject-teaching"}
                  </span>
                  {!derived && <Badge tone="warning">needs one</Badge>}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <select name="staffId" defaultValue={c.formMasterId ?? ""}
                    className="max-w-44 rounded-md border border-border bg-card px-2 py-1 text-xs">
                    <option value="">{autoName ? `Auto — ${autoName} (class teacher)` : "— choose —"}</option>
                    {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <SubmitButton className="rounded border border-border px-2 py-1 text-[12.5px] hover:bg-muted" pendingText="…">Set</SubmitButton>
                </span>
              </form>
            );
          })}
        </div>
      </Card>

      {/* ═══ 3 · needs attention ═══ */}
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Needs attention</h2>
      <Card className="mb-6">
        {issues.length === 0 ? (
          <p className="text-sm text-success">Every subject in every class resolves to exactly one teacher ✓</p>
        ) : (
          <div className="space-y-1.5">
            {/* uncovered cells grouped BY SUBJECT — one line says everything */}
            {[...new Set(issues.filter((i) => i.kind === "uncovered").map((i) => i.subjectId))].map((sid) => {
              const classNames = issues
                .filter((i) => i.kind === "uncovered" && i.subjectId === sid)
                .map((i) => S.classById.get(i.classId)?.name ?? "?");
              return (
                <div key={sid} className="rounded-md border border-warning/50 bg-warning-soft px-3 py-2 text-sm">
                  <b>{S.subjectById.get(sid)?.name ?? "?"}</b> — nobody carries it yet in{" "}
                  <span className="text-muted-foreground">{classNames.join(", ")}</span>.
                  Add it to a teacher&apos;s profile above with those levels ticked.
                </div>
              );
            })}
            {issues.filter((i) => i.kind === "tie").map((i) => {
              const cName = S.classById.get(i.classId)?.name ?? "?";
              const sName = S.subjectById.get(i.subjectId)?.name ?? "?";
              return (
                <div key={i.classId + i.subjectId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning/50 bg-warning-soft px-3 py-2 text-sm">
                  <span><b>{cName} · {sName}</b> — {i.pool.length} teachers are eligible; pick who takes this class:</span>
                  <form action={setAllocation.bind(null, slug, i.classId, i.subjectId)}
                    className="flex items-center gap-1">
                    <select name="teacherId" className="rounded-md border border-border bg-card px-2 py-1 text-xs">
                      {i.pool.map((p) => (
                        <option key={p.staffId} value={p.staffId}>
                          {teacherName(p.staffId)}{p.role === "assistant" ? " (assistant)" : ""}
                        </option>
                      ))}
                    </select>
                    <SubmitButton className="rounded border border-border bg-card px-2 py-1 text-[12.5px]" pendingText="…">Pin</SubmitButton>
                  </form>
                </div>
              );
            })}
          </div>
        )}
        {pins.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-[13px] font-medium text-muted-foreground">
              {pins.length} pinned class-subject choice{pins.length === 1 ? "" : "s"}
            </summary>
            <div className="mt-2 space-y-1">
              {pins.map(([key, tid]) => {
                const [classId, subjectId] = key.split(":");
                return (
                  <form key={key} action={setAllocation.bind(null, slug, classId, subjectId)}
                    className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-[13px]">
                    <span>
                      {S.classById.get(classId)?.name ?? "?"} · {S.subjectById.get(subjectId)?.name ?? "?"} →{" "}
                      <b>{teacherName(tid) ?? "?"}</b>
                    </span>
                    <input type="hidden" name="teacherId" value="" />
                    <SubmitButton className="text-[12.5px] font-medium text-danger hover:underline" pendingText="…">
                      unpin (back to auto)
                    </SubmitButton>
                  </form>
                );
              })}
            </div>
          </details>
        )}
      </Card>
    </div>
  );
}
