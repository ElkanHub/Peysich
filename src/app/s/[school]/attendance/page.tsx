import Link from "next/link";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { classes, students, attendanceRecords } from "@/db/schema";
import { requireModule, getTeacherClassIds } from "@/core/school-context";
import { Card, PageHeader } from "@/ui/kit";

/** Today's classes as cards — grey = not marked, green = marked (doc 10). */
export default async function Attendance({ params }: { params: Promise<{ school: string }> }) {
  const { school: slug } = await params;
  const { school, user } = await requireModule(slug, "attendance", ["admin", "teacher"]);
  const mine = user.role === "teacher" ? await getTeacherClassIds(school.id, user.id) : undefined;
  const today = new Date().toISOString().slice(0, 10);

  let cls = await db.select().from(classes).where(eq(classes.schoolId, school.id));
  if (mine !== undefined) cls = cls.filter((c) => mine?.has(c.id));
  const counts = await db.select({
    classId: attendanceRecords.classId,
    present: sql<number>`count(*) filter (where status = 'present')`,
    total: sql<number>`count(*)`,
  }).from(attendanceRecords)
    .where(and(eq(attendanceRecords.schoolId, school.id), eq(attendanceRecords.date, today)))
    .groupBy(attendanceRecords.classId);
  const rosters = await db.select({ classId: students.classId, n: sql<number>`count(*)` })
    .from(students)
    .where(and(eq(students.schoolId, school.id), eq(students.status, "active")))
    .groupBy(students.classId);
  const byClass = new Map(counts.map((c) => [c.classId, c]));
  const rosterN = new Map(rosters.map((r) => [r.classId, Number(r.n)]));

  return (
    <div>
      <PageHeader title="Attendance" sub={`Today, ${today}`} />
      {mine !== undefined && cls.length === 0 && (
        <p className="text-sm text-muted-foreground">No classes assigned to you yet — ask your admin to set you as a class teacher (Settings) or add you to the timetable.</p>
      )}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cls.map((c) => {
          const marked = byClass.get(c.id);
          return (
            <Link key={c.id} href={`/attendance/${c.id}`}>
              <Card className={marked ? "border-success/40" : ""}>
                <p className="font-medium">{c.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {marked
                    ? <span className="text-success">{marked.present}/{marked.total} present</span>
                    : `${rosterN.get(c.id) ?? 0} students · not marked`}
                </p>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
