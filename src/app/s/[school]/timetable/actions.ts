"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { timetableEntries } from "@/db/schema";
import { requireModule } from "@/core/school-context";
import { getStructure, fmtMin, DAY_LABELS, type Day, DAYS } from "@/core/academics";
import { uid } from "@/lib/utils";

/** Place (or replace) a lesson: class × day × slot → subject. The teacher is
 *  DERIVED from allocations / class-teacher mode, and if that teacher is
 *  already somewhere else at an overlapping time, the placement is refused
 *  with a message naming exactly where they are. */
export async function placeEntry(slug: string, classId: string, day: string, slotId: string, f: FormData) {
  const { school } = await requireModule(slug, "timetable", ["admin"]);
  const subjectId = String(f.get("subjectId") || "");
  const backTo = String(f.get("back") || `/timetable?view=class&c=${classId}`);
  if (!DAYS.includes(day as Day) || !subjectId) redirect(backTo);

  const S = await getStructure(school.id);
  const slot = S.slotById.get(slotId);
  const cls = S.classById.get(classId);
  if (!slot || !cls || slot.kind !== "teaching") redirect(backTo);
  if (!S.effectiveSubjectIds(classId).includes(subjectId)) redirect(`${backTo}&err=notsubject`);

  // clash gate: where would this put the derived teacher?
  const teacherId = S.teacherFor(classId, subjectId);
  if (teacherId) {
    for (const e of S.entries) {
      if (e.day !== day || e.classId === classId) continue;
      if (S.teacherFor(e.classId, e.subjectId, e.teacherId) !== teacherId) continue;
      const other = S.slotById.get(e.slotId);
      if (other && other.startMin < slot.endMin && slot.startMin < other.endMin) {
        const who = S.staffById.get(teacherId)?.name ?? "That teacher";
        const where = S.classById.get(e.classId)?.name ?? "another class";
        const msg = `${who} is already with ${where} on ${DAY_LABELS[day as Day]} ${fmtMin(other.startMin)}–${fmtMin(other.endMin)}. Pick another slot, or change the allocation first.`;
        redirect(`${backTo}&err=clash&detail=${encodeURIComponent(msg)}`);
      }
    }
  }

  // one atomic upsert — a retry after a half-finished attempt can never
  // trip over the (class, day, slot) unique index
  await db.insert(timetableEntries).values({
    id: uid(), schoolId: school.id, classId, subjectId, slotId, day: day as Day,
  }).onConflictDoUpdate({
    target: [timetableEntries.classId, timetableEntries.day, timetableEntries.slotId],
    set: { subjectId, teacherId: null },
  });
  revalidatePath("/timetable");
  redirect(`${backTo}&flash=saved`);
}

/** Per-period teacher choice among the subject's eligible pool (main +
 *  assistants). Empty = back to auto (derived). Double-booking is refused
 *  with a message naming where the teacher already is. */
export async function setEntryTeacher(slug: string, entryId: string, f: FormData) {
  const { school } = await requireModule(slug, "timetable", ["admin"]);
  const teacherId = String(f.get("teacherId") || "");
  const backTo = String(f.get("back") || "/timetable");
  const S = await getStructure(school.id);
  const entry = S.entries.find((e) => e.id === entryId);
  if (!entry) redirect(backTo);
  if (teacherId) {
    const pool = S.poolFor(entry.classId, entry.subjectId);
    if (!pool.some((p) => p.staffId === teacherId)) redirect(`${backTo}&err=notpool`);
    const slot = S.slotById.get(entry.slotId);
    if (slot) {
      for (const e of S.entries) {
        if (e.id === entryId || e.day !== entry.day) continue;
        if (S.teacherFor(e.classId, e.subjectId, e.teacherId) !== teacherId) continue;
        const other = S.slotById.get(e.slotId);
        if (other && other.startMin < slot.endMin && slot.startMin < other.endMin) {
          const who = S.staffById.get(teacherId)?.name ?? "That teacher";
          const where = S.classById.get(e.classId)?.name ?? "another class";
          const msg = `${who} is already with ${where} on ${DAY_LABELS[entry.day as Day]} ${fmtMin(other.startMin)}–${fmtMin(other.endMin)}.`;
          redirect(`${backTo}&err=clash&detail=${encodeURIComponent(msg)}`);
        }
      }
    }
  }
  await db.update(timetableEntries).set({ teacherId: teacherId || null })
    .where(and(eq(timetableEntries.id, entryId), eq(timetableEntries.schoolId, school.id)));
  revalidatePath("/timetable");
  redirect(`${backTo}&flash=saved`);
}

export async function clearEntry(slug: string, entryId: string, f: FormData) {
  const { school } = await requireModule(slug, "timetable", ["admin"]);
  const backTo = String(f.get("back") || "/timetable");
  await db.delete(timetableEntries).where(and(
    eq(timetableEntries.id, entryId), eq(timetableEntries.schoolId, school.id)));
  revalidatePath("/timetable");
  redirect(`${backTo}&flash=done`);
}
