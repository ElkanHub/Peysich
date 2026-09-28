"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { timetableEntries } from "@/db/schema";
import { requireModule } from "@/core/school-context";
import { getStructure, type Day, DAYS, type Structure } from "@/core/academics";
import { withFlash } from "@/lib/flash";
import { uid } from "@/lib/utils";

/** "{teacher} is in {class} then" when the teacher is already elsewhere at
 *  an overlapping time on that day; null when free. `skipEntryId` is the
 *  entry being edited (it can't clash with itself). */
function clashMessage(S: Structure, teacherId: string, day: string, slotId: string, skipEntryId?: string) {
  const slot = S.slotById.get(slotId);
  if (!slot) return null;
  for (const e of S.entries) {
    if (e.id === skipEntryId || e.day !== day) continue;
    if (S.teacherFor(e.classId, e.subjectId, e.teacherId) !== teacherId) continue;
    const other = S.slotById.get(e.slotId);
    if (other && other.startMin < slot.endMin && slot.startMin < other.endMin) {
      const who = S.staffById.get(teacherId)?.name ?? "That teacher";
      const where = S.classById.get(e.classId)?.name ?? "another class";
      return `${who} is in ${where} then`;
    }
  }
  return null;
}

/** Place (or replace) a lesson: class × day × slot → subject. The teacher is
 *  DERIVED from who-teaches-what / class-teacher mode; if that teacher is
 *  already somewhere else at that time the placement is refused with a
 *  message naming where. Called from the slot panel, which stays open — so
 *  this returns instead of redirecting; revalidatePath refreshes the grid. */
export async function placeEntry(slug: string, classId: string, day: string, slotId: string, subjectId: string):
  Promise<{ ok: true } | { error: string }> {
  const { school } = await requireModule(slug, "timetable", ["admin"]);
  if (!DAYS.includes(day as Day) || !subjectId) return { error: "Pick a subject." };
  const S = await getStructure(school.id);
  const slot = S.slotById.get(slotId);
  const cls = S.classById.get(classId);
  if (!slot || !cls || slot.kind !== "teaching") return { error: "That isn't a lesson period." };
  if (!S.effectiveSubjectIds(classId).includes(subjectId))
    return { error: "That subject isn't on this class's list — add it under Settings → Day plan & subjects." };
  const teacherId = S.teacherFor(classId, subjectId);
  const clash = teacherId && clashMessage(S, teacherId, day, slotId, S.entries.find((e) =>
    e.classId === classId && e.day === day && e.slotId === slotId)?.id);
  if (clash) return { error: clash };

  // one atomic upsert — a retry after a half-finished attempt can never
  // trip over the (class, day, slot) unique index
  await db.insert(timetableEntries).values({
    id: uid(), schoolId: school.id, classId, subjectId, slotId, day: day as Day,
  }).onConflictDoUpdate({
    target: [timetableEntries.classId, timetableEntries.day, timetableEntries.slotId],
    set: { subjectId, teacherId: null },
  });
  revalidatePath("/timetable");
  return { ok: true };
}

/** Per-period teacher choice among the subject's eligible pool (main +
 *  assistants). Empty = back to the usual (derived) teacher. Double-booking
 *  is refused with a message naming where the teacher already is. */
export async function setEntryTeacher(slug: string, entryId: string, f: FormData) {
  const { school } = await requireModule(slug, "timetable", ["admin"]);
  const teacherId = String(f.get("teacherId") || "");
  const backTo = String(f.get("back") || "/timetable");
  const S = await getStructure(school.id);
  const entry = S.entries.find((e) => e.id === entryId);
  if (!entry) redirect(withFlash(backTo, "That lesson is no longer there.", { error: true }));
  let who = "the usual teacher";
  if (teacherId) {
    const pool = S.poolFor(entry.classId, entry.subjectId);
    if (!pool.some((p) => p.staffId === teacherId))
      redirect(withFlash(backTo, "That teacher isn't on this subject for this class — add it to their profile first.", { error: true }));
    const clash = clashMessage(S, teacherId, entry.day, entry.slotId, entryId);
    if (clash) redirect(withFlash(backTo, clash, { error: true }));
    who = S.staffById.get(teacherId)?.name ?? "that teacher";
  }
  await db.update(timetableEntries).set({ teacherId: teacherId || null })
    .where(and(eq(timetableEntries.id, entryId), eq(timetableEntries.schoolId, school.id)));
  revalidatePath("/timetable");
  redirect(withFlash(backTo, `This period is now taught by ${who}.`));
}

export async function clearEntry(slug: string, entryId: string, f: FormData) {
  const { school } = await requireModule(slug, "timetable", ["admin"]);
  const backTo = String(f.get("back") || "/timetable");
  await db.delete(timetableEntries).where(and(
    eq(timetableEntries.id, entryId), eq(timetableEntries.schoolId, school.id)));
  revalidatePath("/timetable");
  redirect(withFlash(backTo, "Lesson removed."));
}
