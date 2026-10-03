import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { guardians, studentGuardians, students } from "@/db/schema";
import { requireSchool, getTeacherScope } from "@/core/school-context";

/** The child and the people to tell — the office for any child, a teacher
 *  only for a child in one of their classes (the student file's own rule). */
export async function emergencyContext(slug: string, id: string) {
  const { school, user } = await requireSchool(slug, ["admin", "teacher"]);
  const [s] = await db.select().from(students).where(and(eq(students.id, id), eq(students.schoolId, school.id)));
  if (!s) notFound();
  if (!["admin", "platform_admin"].includes(user.role)) {
    const scope = await getTeacherScope(school.id, user.id);
    if (!s.classId || !scope?.allClassIds.has(s.classId)) notFound();
  }
  const parents = await db.select({ id: guardians.id, name: guardians.name }).from(studentGuardians)
    .innerJoin(guardians, eq(studentGuardians.guardianId, guardians.id)).where(eq(studentGuardians.studentId, id));
  return { school, user, s, parents };
}
