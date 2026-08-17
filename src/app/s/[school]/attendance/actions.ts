"use server";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { attendanceRecords, students } from "@/db/schema";
import { requireModule, getCurrentTerm } from "@/core/school-context";
import { uid } from "@/lib/utils";

/** Save a class register for today. Default-present: form posts only exceptions,
 *  everyone else is recorded present. Idempotent per (student, date). */
export async function saveRegister(slug: string, classId: string, f: FormData) {
  const { school, user } = await requireModule(slug, "attendance", ["admin", "teacher"]);
  const term = await getCurrentTerm(school.id);
  if (!term) throw new Error("No current term");
  const today = new Date().toISOString().slice(0, 10);

  const roster = await db.select({ id: students.id }).from(students)
    .where(and(eq(students.schoolId, school.id), eq(students.classId, classId),
      eq(students.status, "active")));
  const ids = roster.map((r) => r.id);
  if (!ids.length) return;

  await db.delete(attendanceRecords).where(and(
    eq(attendanceRecords.schoolId, school.id), eq(attendanceRecords.date, today),
    inArray(attendanceRecords.studentId, ids)));
  await db.insert(attendanceRecords).values(ids.map((sidv) => ({
    id: uid(), schoolId: school.id, studentId: sidv, classId, termId: term.id,
    date: today, status: String(f.get(`st_${sidv}`) || "present"), markedBy: user.id,
  })));
  // absence alerts to guardians queue here (SMS fan-out lands with comms module)
  revalidatePath(`/attendance`);
}
