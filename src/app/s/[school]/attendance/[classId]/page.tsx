import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { classes, students, attendanceRecords } from "@/db/schema";
import { requireModule } from "@/core/school-context";
import { PageHeader } from "@/ui/kit";
import { Register } from "./register";

export default async function ClassRegister({ params }: {
  params: Promise<{ school: string; classId: string }>;
}) {
  const { school: slug, classId } = await params;
  const { school } = await requireModule(slug, "attendance", ["admin", "teacher"]);
  const [cls] = await db.select().from(classes)
    .where(and(eq(classes.id, classId), eq(classes.schoolId, school.id)));
  if (!cls) notFound();
  const today = new Date().toISOString().slice(0, 10);
  const roster = await db.select({
    id: students.id, firstName: students.firstName, lastName: students.lastName,
  }).from(students)
    .where(and(eq(students.schoolId, school.id), eq(students.classId, classId),
      eq(students.status, "active")))
    .orderBy(students.lastName);
  const existing = await db.select().from(attendanceRecords)
    .where(and(eq(attendanceRecords.schoolId, school.id),
      eq(attendanceRecords.classId, classId), eq(attendanceRecords.date, today)));
  const statusMap = Object.fromEntries(existing.map((r) => [r.studentId, r.status]));

  return (
    <div className="max-w-lg">
      <PageHeader title={cls.name} sub={`Register · ${today} · everyone starts Present — tap only the exceptions`} />
      <Register slug={slug} classId={classId} roster={roster} initial={statusMap} />
    </div>
  );
}
