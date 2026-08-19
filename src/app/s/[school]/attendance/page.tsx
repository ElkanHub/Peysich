import Link from "next/link";
import { and, eq, sql, inArray } from "drizzle-orm";
import { db } from "@/db";
import { classes, students, subjects, attendanceRecords, staff, teachingAssignments } from "@/db/schema";
import { requireModule, getTeacherScope } from "@/core/school-context";
import { Card, PageHeader, Empty } from "@/ui/kit";

/** Attendance home. Teachers: THEIR register(s) to mark, plus a muted list
 *  of subject-only classes (no marking — that's the class teacher's job).
 *  Admins: the monitoring wall — every class, marked or not, click to open. */
export default async function Attendance({ params }: { params: Promise<{ school: string }> }) {
  const { school: slug } = await params;
  const { school, user } = await requireModule(slug, "attendance", ["admin", "teacher"]);
  const today = new Date().toISOString().slice(0, 10);
  const isTeacher = user.role === "teacher";
  const scope = isTeacher ? await getTeacherScope(school.id, user.id) : null;

  const [cls, counts, rosters, tchs] = await Promise.all([
    db.select().from(classes).where(eq(classes.schoolId, school.id)),
    db.select({
      classId: attendanceRecords.classId,
      present: sql<number>`count(*) filter (where status = 'present')`,
      total: sql<number>`count(*)`,
    }).from(attendanceRecords)
      .where(and(eq(attendanceRecords.schoolId, school.id), eq(attendanceRecords.date, today)))
      .groupBy(attendanceRecords.classId),
    db.select({ classId: students.classId, n: sql<number>`count(*)` }).from(students)
      .where(and(eq(students.schoolId, school.id), eq(students.status, "active")))
      .groupBy(students.classId),
    db.select({ id: staff.id, name: staff.name }).from(staff).where(eq(staff.schoolId, school.id)),
  ]);
  const byClass = new Map(counts.map((c) => [c.classId, c]));
  const rosterN = new Map(rosters.map((r) => [r.classId, Number(r.n)]));
  const teacherName = new Map(tchs.map((t) => [t.id, t.name]));

  // ── teacher view ──
  if (isTeacher) {
    const homerooms = cls.filter((c) => scope?.homeroomIds.has(c.id));
    const subjectOnly = cls.filter((c) =>
      scope?.subjectClassIds.has(c.id) && !scope.homeroomIds.has(c.id));
    const subjectNames = subjectOnly.length && scope
      ? await db.select({ classId: teachingAssignments.classId, name: subjects.name })
          .from(teachingAssignments)
          .innerJoin(subjects, eq(teachingAssignments.subjectId, subjects.id))
          .where(and(eq(teachingAssignments.teacherId, scope.staffId),
            inArray(teachingAssignments.classId, subjectOnly.map((c) => c.id))))
      : [];
    const subsOf = new Map<string, string[]>();
    for (const s of subjectNames) {
      if (!subsOf.has(s.classId)) subsOf.set(s.classId, []);
      subsOf.get(s.classId)!.push(s.name);
    }
    return (
      <div>
        <PageHeader title="Attendance" sub={`Today, ${today}`} />
        <h2 className="mb-3 text-sm font-semibold">My register{homerooms.length === 1 ? "" : "s"}</h2>
        {homerooms.length === 0 && (
          <Empty title="You are not a class teacher"
            hint="Attendance is marked by the class teacher (form master). If that should be you, ask your admin to assign you on Teaching & allocations." />
        )}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {homerooms.map((c) => {
            const marked = byClass.get(c.id);
            return (
              <Link key={c.id} href={`/attendance/${c.id}`}>
                <Card className={marked ? "border-success/40" : "border-warning/50"}>
                  <p className="font-medium">{c.name}</p>
                  <p className="mt-1 text-sm">
                    {marked
                      ? <span className="text-success">{marked.present}/{marked.total} present ✓</span>
                      : <span className="font-medium text-warning">Mark register →</span>}
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
        {subjectOnly.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-1 text-sm font-semibold text-muted-foreground">Classes you teach (subject only)</h2>
            <p className="mb-3 text-[12.5px] text-muted-foreground">
              Their registers are marked by each class teacher — you enter scores for your subjects under Assessment.
            </p>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {subjectOnly.map((c) => (
                <Card key={c.id} className="opacity-70">
                  <p className="font-medium">{c.name}</p>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    {(subsOf.get(c.id) ?? []).join(", ") || "—"}
                  </p>
                  <p className="mt-1 text-[11.5px] text-faint">
                    Register: {teacherName.get(cls.find((x) => x.id === c.id)?.classTeacherId ?? "") ?? "no class teacher"}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── admin monitoring wall ──
  const markedCount = cls.filter((c) => byClass.has(c.id)).length;
  return (
    <div>
      <PageHeader title="Attendance" sub={`Today, ${today} · ${markedCount}/${cls.length} registers marked`} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cls.map((c) => {
          const marked = byClass.get(c.id);
          return (
            <Link key={c.id} href={`/attendance/${c.id}`}>
              <Card className={marked ? "border-success/40" : "border-warning/50"}>
                <p className="font-medium">{c.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {marked
                    ? <span className="text-success">{marked.present}/{marked.total} present</span>
                    : <span className="text-warning">{rosterN.get(c.id) ?? 0} students · not marked</span>}
                </p>
                <p className="mt-1 truncate text-[11.5px] text-faint">
                  {teacherName.get(c.classTeacherId ?? "") ?? "no class teacher"}
                </p>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
