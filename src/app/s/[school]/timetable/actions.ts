"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { lessons } from "@/db/schema";
import { requireModule } from "@/core/school-context";
import { uid } from "@/lib/utils";

const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

export async function addLesson(slug: string, classId: string, f: FormData) {
  const { school } = await requireModule(slug, "timetable", ["admin"]);
  const day = String(f.get("day")) as "mon" | "tue" | "wed" | "thu" | "fri";
  const startMin = toMin(String(f.get("start"))), endMin = toMin(String(f.get("end")));
  if (endMin <= startMin) return;
  const teacherId = String(f.get("teacherId") || "") || null;
  // clash detection: same class OR same teacher overlapping on that day
  const dayRows = await db.select().from(lessons)
    .where(and(eq(lessons.schoolId, school.id), eq(lessons.day, day)));
  const overlap = (a: { startMin: number; endMin: number }) => a.startMin < endMin && startMin < a.endMin;
  if (dayRows.some((r) => overlap(r) && (r.classId === classId || (teacherId && r.teacherId === teacherId))))
    return; // clash → rejected (UI states this contract)
  await db.insert(lessons).values({
    id: uid(), schoolId: school.id, classId, subjectId: String(f.get("subjectId")),
    teacherId, day, startMin, endMin,
  });
  revalidatePath(`/timetable`);
}

export async function deleteLesson(slug: string, lessonId: string) {
  const { school } = await requireModule(slug, "timetable", ["admin"]);
  await db.delete(lessons).where(and(eq(lessons.id, lessonId), eq(lessons.schoolId, school.id)));
  revalidatePath(`/timetable`);
}
