import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { staff, classes, subjects, levels, teachingAssignments, lessons } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { Card, DataTable, PageHeader, Tr, Td } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";
import { setClassTeacher } from "../../accounts-actions";
import { setAllocation, fillClassWithTeacher } from "../staff-actions";

/** TEACHING & ALLOCATIONS — both school models on one screen:
 *  · class teacher (form master) per class, with the primary-school shortcut
 *    "class teacher takes all subjects";
 *  · subject teaching per class-subject cell (the departmental/JHS grid).
 *  Assigning outside a teacher's listed competencies warns, never blocks. */
export default async function Allocations({ params, searchParams }: {
  params: Promise<{ school: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  const { school: slug } = await params;
  const { err } = await searchParams;
  const { school } = await requireSchool(slug, ["admin"]);
  const [lvs, cls, subs, teachers, allocs, load] = await Promise.all([
    db.select().from(levels).where(eq(levels.schoolId, school.id)).orderBy(levels.sortOrder),
    db.select().from(classes).where(eq(classes.schoolId, school.id)),
    db.select().from(subjects).where(eq(subjects.schoolId, school.id)).orderBy(subjects.name),
    db.select().from(staff).where(and(
      eq(staff.schoolId, school.id), eq(staff.staffType, "teaching"), eq(staff.status, "active")))
      .orderBy(staff.name),
    db.select().from(teachingAssignments).where(eq(teachingAssignments.schoolId, school.id)),
    db.select({ teacherId: lessons.teacherId, n: sql<number>`count(*)` }).from(lessons)
      .where(eq(lessons.schoolId, school.id)).groupBy(lessons.teacherId),
  ]);
  const levelOrder = new Map(lvs.map((l, i) => [l.id, i]));
  const ordered = [...cls].sort((a, b) =>
    (levelOrder.get(a.levelId) ?? 99) - (levelOrder.get(b.levelId) ?? 99) || a.name.localeCompare(b.name));
  const byCell = new Map(allocs.map((a) => [`${a.classId}:${a.subjectId}`, a.teacherId]));
  const teacherById = new Map(teachers.map((t) => [t.id, t]));
  const periodsOf = new Map(load.filter((l) => l.teacherId).map((l) => [l.teacherId!, Number(l.n)]));

  // per-teacher workload summary
  const workload = teachers.map((t) => ({
    t,
    homerooms: cls.filter((c) => c.classTeacherId === t.id).map((c) => c.name),
    cells: allocs.filter((a) => a.teacherId === t.id).length,
    classes: new Set(allocs.filter((a) => a.teacherId === t.id).map((a) => a.classId)).size,
    periods: periodsOf.get(t.id) ?? 0,
  }));

  return (
    <div className="max-w-4xl">
      <PageHeader title="Teaching & allocations"
        sub="Who teaches what: class teachers (form masters) and per-subject assignments. The timetable and score-sheet access follow this." />

      {err === "noteacher" && (
        <p className="mb-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          That class has no class teacher yet — set one first, then use the shortcut.
        </p>
      )}

      <Card className="mb-5">
        <h2 className="font-semibold">Teacher workloads</h2>
        <div className="mt-3">
          <DataTable head={["Teacher", "Class teacher of", "Subject cells", "Classes", "Periods/wk"]}>
            {workload.map(({ t, homerooms, cells, classes: nc, periods }) => (
              <Tr key={t.id}>
                <Td className="font-medium">
                  <a href={`/staff/${t.id}`} className="text-primary">{t.name}</a>
                </Td>
                <Td>{homerooms.join(", ") || "—"}</Td>
                <Td data-nums="">{cells}</Td>
                <Td data-nums="">{nc}</Td>
                <Td data-nums="">{periods}</Td>
              </Tr>
            ))}
          </DataTable>
        </div>
        {teachers.length === 0 && (
          <p className="mt-2 text-sm text-muted-foreground">No active teaching staff yet — onboard teachers under Staff first.</p>
        )}
      </Card>

      {ordered.map((c) => (
        <div key={c.id} id={`class-${c.id}`} className="mb-4">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold">{c.name}</p>
            <div className="flex flex-wrap items-center gap-2">
              <form action={setClassTeacher.bind(null, slug, c.id)} className="flex items-center gap-1.5">
                <span className="text-[13px] text-muted-foreground">Class teacher</span>
                <select name="staffId" defaultValue={c.classTeacherId ?? ""}
                  className="rounded-md border border-border px-2 py-1.5 text-sm">
                  <option value="">None</option>
                  {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <SubmitButton className="rounded border border-border px-2.5 py-1.5 text-xs hover:bg-muted">Set</SubmitButton>
              </form>
              {c.classTeacherId && (
                <form action={fillClassWithTeacher.bind(null, slug, c.id)}>
                  <SubmitButton className="rounded-md bg-brand-soft px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-brand-soft/70"
                    pendingText="Filling…">
                    Class teacher takes all subjects
                  </SubmitButton>
                </form>
              )}
            </div>
          </div>
          <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {subs.map((sub) => {
              const tid = byCell.get(`${c.id}:${sub.id}`) ?? "";
              const t = tid ? teacherById.get(tid) : null;
              const outside = t && t.competencies.length > 0 && !t.competencies.includes(sub.name);
              return (
                <form key={sub.id} action={setAllocation.bind(null, slug, c.id, sub.id)}
                  className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5">
                  <span className="min-w-0 truncate text-sm">
                    {sub.name}
                    {outside && (
                      <span className="ml-1.5 text-[11px] text-warning"
                        title={`${t!.name} is not listed as qualified for ${sub.name}`}>
                        ⚠ outside competencies
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <select name="teacherId" defaultValue={tid}
                      className="max-w-40 rounded-md border border-border px-2 py-1 text-xs">
                      <option value="">Unassigned</option>
                      {teachers.map((tt) => <option key={tt.id} value={tt.id}>{tt.name}</option>)}
                    </select>
                    <SubmitButton className="rounded border border-border px-2 py-1 text-[11.5px] hover:bg-muted">Set</SubmitButton>
                  </span>
                </form>
              );
            })}
          </div>
        </Card>
        </div>
      ))}

      {ordered.length === 0 && (
        <Card>
          <p className="text-sm text-muted-foreground">
            No classes yet — create your structure in <a href="/settings" className="font-medium text-primary">Settings</a> first.
          </p>
        </Card>
      )}
    </div>
  );
}
