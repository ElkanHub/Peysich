"use server";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  levels, classes, subjects, students, enrollments, staff,
  teachingAssignments, lessons, assessments, scores, feeStructures, rooms,
} from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { uid } from "@/lib/utils";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;

/** Structure edits ripple everywhere (allocations, assessment, timetable,
 *  fees, rosters) — revalidate the surfaces that render them. */
const touch = () => {
  for (const p of ["/settings", "/staff/allocations", "/assessment", "/timetable",
    "/fees", "/students", "/attendance"]) revalidatePath(p);
};

/* ── Subjects ────────────────────────────────────────────────────────── */

export async function addSubject(slug: string, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  const name = str(f, "name");
  if (!name) return;
  await db.insert(subjects).values({ id: uid(), schoolId: school.id, name })
    .onConflictDoNothing(); // unique per school — re-adding is a no-op
  touch();
  redirect("/settings?flash=saved");
}

/** Rename reflects everywhere by id — plus teacher competencies, which
 *  store subject NAMES, are rewritten so qualification flags stay true. */
export async function renameSubject(slug: string, subjectId: string, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  const name = str(f, "name");
  if (!name) return;
  const [sub] = await db.select().from(subjects)
    .where(and(eq(subjects.id, subjectId), eq(subjects.schoolId, school.id)));
  if (!sub || sub.name === name) redirect("/settings?flash=saved");
  await db.update(subjects).set({ name }).where(eq(subjects.id, subjectId));
  const teachers = await db.select().from(staff)
    .where(and(eq(staff.schoolId, school.id), eq(staff.staffType, "teaching")));
  for (const t of teachers) {
    if (t.competencies.includes(sub.name)) {
      await db.update(staff)
        .set({ competencies: t.competencies.map((c) => (c === sub.name ? name : c)) })
        .where(eq(staff.id, t.id));
    }
  }
  touch();
  redirect("/settings?flash=saved");
}

/** Delete guarded by usage: score sheets, allocations and timetable slots
 *  are listed first and must be acknowledged. Published report cards are
 *  immutable snapshots and keep the subject's history either way. */
export async function deleteSubject(slug: string, subjectId: string, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  const [sub] = await db.select().from(subjects)
    .where(and(eq(subjects.id, subjectId), eq(subjects.schoolId, school.id)));
  if (!sub) return;
  const [assess, [{ n: allocN }], [{ n: lessonN }]] = await Promise.all([
    db.select({ id: assessments.id }).from(assessments)
      .where(and(eq(assessments.schoolId, school.id), eq(assessments.subjectId, subjectId))),
    db.select({ n: sql<number>`count(*)` }).from(teachingAssignments)
      .where(eq(teachingAssignments.subjectId, subjectId)),
    db.select({ n: sql<number>`count(*)` }).from(lessons)
      .where(and(eq(lessons.schoolId, school.id), eq(lessons.subjectId, subjectId))),
  ]);
  const used = assess.length + Number(allocN) + Number(lessonN) > 0;
  if (used && f.get("confirm") !== "on") redirect("/settings?err=subjinuse");
  if (assess.length) {
    await db.delete(scores).where(inArray(scores.assessmentId, assess.map((a) => a.id)));
    await db.delete(assessments).where(inArray(assessments.id, assess.map((a) => a.id)));
  }
  await db.delete(lessons).where(and(
    eq(lessons.schoolId, school.id), eq(lessons.subjectId, subjectId)));
  await db.delete(subjects).where(eq(subjects.id, subjectId)); // allocations cascade
  const teachers = await db.select().from(staff)
    .where(and(eq(staff.schoolId, school.id), eq(staff.staffType, "teaching")));
  for (const t of teachers) {
    if (t.competencies.includes(sub.name)) {
      await db.update(staff)
        .set({ competencies: t.competencies.filter((c) => c !== sub.name) })
        .where(eq(staff.id, t.id));
    }
  }
  touch();
  redirect("/settings?flash=done");
}

/* ── Levels ──────────────────────────────────────────────────────────── */

export async function addLevel(slug: string, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  const name = str(f, "name");
  if (!name) return;
  const afterId = String(f.get("afterId") ?? "");
  const all = await db.select().from(levels)
    .where(eq(levels.schoolId, school.id)).orderBy(levels.sortOrder);
  const after = all.find((l) => l.id === afterId);
  const sortOrder = after ? after.sortOrder + 1 : (all.at(-1)?.sortOrder ?? -1) + 1;
  // shift everything at/above the slot so promotion order stays exact
  await db.update(levels).set({ sortOrder: sql`${levels.sortOrder} + 1` })
    .where(and(eq(levels.schoolId, school.id), gte(levels.sortOrder, sortOrder)));
  // a name picked from the GES template gets its canonical code, so the
  // preschool/primary/JHS grouping and reports recognise it
  const { LEVEL_TEMPLATE } = await import("@/lib/levels");
  const tpl = LEVEL_TEMPLATE.find(([, n]) => n.toLowerCase() === name.toLowerCase());
  await db.insert(levels).values({
    id: uid(), schoolId: school.id,
    code: tpl?.[0] ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name, sortOrder,
    preschool: tpl ? Boolean(tpl[2]) : f.get("preschool") === "on",
  }).onConflictDoNothing();
  touch();
  redirect("/settings?flash=saved");
}

export async function updateLevel(slug: string, levelId: string, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  const name = str(f, "name");
  await db.update(levels).set({
    ...(name ? { name } : {}),
    preschool: f.get("preschool") === "on",
  }).where(and(eq(levels.id, levelId), eq(levels.schoolId, school.id)));
  touch();
  redirect("/settings?flash=saved");
}

/** A level with classes or fee items under it cannot be removed. */
export async function deleteLevel(slug: string, levelId: string) {
  const { school } = await requireSchool(slug, ["admin"]);
  const [[{ n: classN }], [{ n: feeN }]] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(classes)
      .where(and(eq(classes.schoolId, school.id), eq(classes.levelId, levelId))),
    db.select({ n: sql<number>`count(*)` }).from(feeStructures)
      .where(and(eq(feeStructures.schoolId, school.id), eq(feeStructures.levelId, levelId))),
  ]);
  if (Number(classN) > 0) redirect("/settings?err=levelhasclasses");
  if (Number(feeN) > 0) redirect("/settings?err=levelhasfees");
  await db.delete(levels).where(and(eq(levels.id, levelId), eq(levels.schoolId, school.id)));
  touch();
  redirect("/settings?flash=done");
}

/* ── Classes ─────────────────────────────────────────────────────────── */

export async function renameClass(slug: string, classId: string, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  const name = str(f, "name");
  if (!name) return;
  await db.update(classes).set({ name })
    .where(and(eq(classes.id, classId), eq(classes.schoolId, school.id)));
  touch();
  redirect("/settings?flash=saved");
}

/** A class with enrolment history is NEVER deleted — that history backs
 *  report cards, attendance and leaving certificates. Empty classes go. */
export async function deleteClass(slug: string, classId: string) {
  const { school } = await requireSchool(slug, ["admin"]);
  const [[{ n: enrolN }], [{ n: kidsN }]] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(enrollments)
      .where(and(eq(enrollments.schoolId, school.id), eq(enrollments.classId, classId))),
    db.select({ n: sql<number>`count(*)` }).from(students)
      .where(and(eq(students.schoolId, school.id), eq(students.classId, classId))),
  ]);
  if (Number(enrolN) > 0 || Number(kidsN) > 0) redirect("/settings?err=classinuse");
  await db.delete(lessons).where(and(
    eq(lessons.schoolId, school.id), eq(lessons.classId, classId)));
  await db.delete(classes).where(and(eq(classes.id, classId), eq(classes.schoolId, school.id)));
  touch();
  redirect("/settings?flash=done");
}

/* ── Rooms ───────────────────────────────────────────────────────────── */

export async function updateRoom(slug: string, roomId: string, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  const name = str(f, "name");
  await db.update(rooms).set({
    ...(name ? { name } : {}),
    kind: String(f.get("kind") || "classroom"),
    capacity: Number(f.get("capacity")) || null,
    notes: str(f, "notes"),
  }).where(and(eq(rooms.id, roomId), eq(rooms.schoolId, school.id)));
  touch();
  redirect("/settings?flash=saved");
}
