import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { staff, staffTeaching } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { getStructure, SECTION_LABELS, type Section } from "@/core/academics";
import { Card, PageHeader, Badge } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";
import { setAllocation, setFormMaster } from "../staff-actions";
import { AllocationMatrix, type MatrixCell, type MatrixColumn } from "./matrix";

/** Teacher identity colors — CVD-checked base set, cycled deterministically. */
const TEACHER_COLORS = [
  "#A33268", "#0084B8", "#A8690A", "#6455CC", "#1B7F4B",
  "#B3417A", "#2E6E8E", "#7A5C2E", "#4E63C0", "#207F70",
];

/** TEACHING & ALLOCATIONS — the Allocation Matrix on top (rows = subjects,
 *  columns = classes; drag teachers in, sweep spans, everything derives),
 *  with Form masters and Needs attention below. */
export default async function Allocations({ params }: { params: Promise<{ school: string }> }) {
  const { school: slug } = await params;
  const { school } = await requireSchool(slug, ["admin"]);
  const S = await getStructure(school.id);
  const teacherRows = await db.select().from(staff).where(and(
    eq(staff.schoolId, school.id), eq(staff.staffType, "teaching"), eq(staff.status, "active")))
    .orderBy(staff.name);
  const profileRows = await db.select().from(staffTeaching)
    .where(eq(staffTeaching.schoolId, school.id));

  const ordered = [...S.classes].sort((a, b) =>
    (S.levelById.get(a.levelId)?.sortOrder ?? 99) - (S.levelById.get(b.levelId)?.sortOrder ?? 99)
    || a.name.localeCompare(b.name));
  const teacherName = (id: string | null) => (id && S.staffById.get(id)?.name) || null;

  // ── matrix props ──
  const load = new Map<string, number>();
  for (const c of ordered) {
    if (c.classTeacherId) load.set(c.classTeacherId, (load.get(c.classTeacherId) ?? 0) + 1);
  }
  for (const r of profileRows) load.set(r.staffId, (load.get(r.staffId) ?? 0) + 1);
  const teachers = teacherRows.map((t, i) => ({
    id: t.id, name: t.name, color: TEACHER_COLORS[i % TEACHER_COLORS.length],
    load: load.get(t.id) ?? 0,
  }));

  const columns: MatrixColumn[] = ordered.map((c) => {
    const ct = S.modeBySection.get(S.sectionOfClass(c)) === "class_teacher";
    const main = c.classTeacherId ? { id: c.classTeacherId, name: teacherName(c.classTeacherId) ?? "?" } : null;
    const assistants = (S.classAssistants.get(c.id) ?? [])
      .map((a) => ({ id: a.staffId, name: teacherName(a.staffId) ?? "?" }));
    return { id: c.id, name: c.name, ct, main, assistants };
  });
  const bands = (["preschool", "primary", "jhs"] as Section[])
    .map((sec) => ({
      label: `${SECTION_LABELS[sec]} · ${S.modeBySection.get(sec) === "class_teacher" ? "class teaching" : "subject teaching"}`,
      span: ordered.filter((c) => S.sectionOfClass(c) === sec).length,
    }))
    .filter((b) => b.span > 0);

  // subjects that appear on at least one subject-mode class's list, name order
  const subjectIds = new Set<string>();
  for (const c of ordered) {
    if (S.modeBySection.get(S.sectionOfClass(c)) === "class_teacher") continue;
    for (const sid of S.effectiveSubjectIds(c.id)) subjectIds.add(sid);
  }
  const subjects = [...subjectIds]
    .map((id) => ({ id, name: S.subjectById.get(id)?.name ?? "?" }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const cells: Record<string, MatrixCell> = {};
  for (const c of ordered) {
    if (S.modeBySection.get(S.sectionOfClass(c)) === "class_teacher") continue;
    const eff = new Set(S.effectiveSubjectIds(c.id));
    for (const sub of subjects) {
      const key = `${sub.id}|${c.id}`;
      if (!eff.has(sub.id)) { cells[key] = { off: true }; continue; }
      const pool = S.poolFor(c.id, sub.id)
        .map((p) => ({ id: p.staffId, name: teacherName(p.staffId) ?? "?", role: p.role }));
      const mainId = S.teacherFor(c.id, sub.id);
      cells[key] = {
        main: mainId ? { id: mainId, name: teacherName(mainId) ?? "?" } : null,
        pinned: S.pins.has(`${c.id}:${sub.id}`),
        tie: !mainId && pool.length > 1,
        assistants: pool.filter((p) => p.role === "assistant" && p.id !== mainId),
        pool,
      };
    }
  }

  const issues = S.allocationIssues();
  const pins = [...S.pins.entries()];

  return (
    <div className="max-w-6xl">
      <PageHeader title="Teaching & allocations"
        sub="One grid, whole school — drag a teacher in once and the timetable, registers and score sheets follow." />

      <AllocationMatrix slug={slug} teachers={teachers} bands={bands}
        columns={columns} subjects={subjects} cells={cells} />

      {/* ═══ form masters ═══ */}
      <h2 className="mb-2 mt-8 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Form masters</h2>
      <Card className="mb-6">
        <p className="mb-2 text-[13px] text-muted-foreground">
          The responsible teacher of each class — register, report cards, &quot;my class&quot;. Class-teaching
          classes default to their class teacher; subject-teaching classes appoint one.
        </p>
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {ordered.map((c) => {
            const mode = S.modeBySection.get(S.sectionOfClass(c));
            const derived = S.formMasterOf(c.id);
            const autoName = mode === "class_teacher" ? teacherName(c.classTeacherId) : null;
            return (
              <form key={c.id} action={setFormMaster.bind(null, slug, c.id)}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5">
                <span className="min-w-0 truncate text-sm font-medium">
                  {c.name}
                  {!derived && <Badge tone="warning">needs one</Badge>}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <select name="staffId" defaultValue={c.formMasterId ?? ""}
                    className="max-w-40 rounded-md border border-border bg-card px-2 py-1 text-xs">
                    <option value="">{autoName ? `Auto — ${autoName}` : "— choose —"}</option>
                    {teacherRows.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <SubmitButton className="rounded border border-border px-2 py-1 text-[12.5px] hover:bg-muted" pendingText="…">Set</SubmitButton>
                </span>
              </form>
            );
          })}
        </div>
      </Card>

      {/* ═══ needs attention ═══ */}
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Needs attention</h2>
      <Card className="mb-6">
        {issues.length === 0 ? (
          <p className="text-sm text-success">Every subject in every class resolves to exactly one teacher ✓</p>
        ) : (
          <div className="space-y-1.5">
            {[...new Set(issues.filter((i) => i.kind === "uncovered").map((i) => i.subjectId))].map((sid) => {
              const classNames = issues
                .filter((i) => i.kind === "uncovered" && i.subjectId === sid)
                .map((i) => S.classById.get(i.classId)?.name ?? "?");
              return (
                <div key={sid} className="rounded-md border border-warning/50 bg-warning-soft px-3 py-2 text-sm">
                  <b>{S.subjectById.get(sid)?.name ?? "?"}</b> — nobody carries it yet in{" "}
                  <span className="text-muted-foreground">{classNames.join(", ")}</span>.
                  Sweep those cells above and drop a teacher on them.
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
