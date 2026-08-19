"use server";
import { and, eq, desc, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { attendanceRecords, students, classes, staff, staffNudges } from "@/db/schema";
import { requireModule, getCurrentTerm, getTeacherScope } from "@/core/school-context";
import { uid } from "@/lib/utils";

/** Save a class register for today. Default-present: form posts only exceptions,
 *  everyone else is recorded present. Idempotent per (student, date).
 *  RIGHTS: the class teacher marks their homeroom; an admin may mark on the
 *  teacher's behalf. Subject teachers cannot mark attendance. */
export async function saveRegister(slug: string, classId: string, f: FormData) {
  const { school, user } = await requireModule(slug, "attendance", ["admin", "teacher"]);
  if (user.role === "teacher") {
    const scope = await getTeacherScope(school.id, user.id);
    if (!scope?.homeroomIds.has(classId))
      throw new Error("Only the class teacher marks this register");
  }
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
  // absence alerts → guardians (the feature that sells to parents, doc 10)
  const absent = ids.filter((sidv) => String(f.get(`st_${sidv}`)) === "absent");
  if (absent.length) {
    const { guardians, studentGuardians } = await import("@/db/schema");
    const gs = await db.select({ phone: guardians.phone, sid: studentGuardians.studentId })
      .from(studentGuardians)
      .innerJoin(guardians, eq(studentGuardians.guardianId, guardians.id))
      .where(inArray(studentGuardians.studentId, absent));
    const names = new Map((await db.select().from(students)
      .where(inArray(students.id, absent))).map((s) => [s.id, s.firstName]));
    const { sendSmsBatch } = await import("@/lib/notify");
    await sendSmsBatch(gs.map((g) => ({
      schoolId: school.id, to: g.phone, kind: "absence",
      senderId: school.branding.smsSenderId,
      body: `${names.get(g.sid)} was marked absent today at ${school.name}. Contact the office if unexpected.`,
    })));
  }
  revalidatePath(`/attendance`);
}

/** Admin nudge: "the register isn't marked yet" — SMS/email to the class
 *  teacher (real once Arkesel/Resend keys exist, queued meanwhile) AND a
 *  banner on their dashboard until the register is saved. */
export async function remindClassTeacher(slug: string, classId: string) {
  const { school, user } = await requireModule(slug, "attendance", ["admin"]);
  const [cls] = await db.select().from(classes)
    .where(and(eq(classes.id, classId), eq(classes.schoolId, school.id)));
  if (!cls?.classTeacherId) redirect(`/attendance/${classId}?err=noteacher`);
  const [t] = await db.select().from(staff).where(eq(staff.id, cls.classTeacherId!));
  if (!t) redirect(`/attendance/${classId}?err=noteacher`);

  const message = `Good day ${t.name.split(" ")[0]} — the ${cls.name} register for today hasn't been marked yet. Please mark it in Peysich. — ${school.name}`;
  await db.insert(staffNudges).values({
    id: uid(), schoolId: school.id, staffId: t.id,
    kind: "attendance", refId: classId, message, sentBy: user.name,
  });
  const { sendSmsBatch } = await import("@/lib/notify");
  if (t.phone) await sendSmsBatch([{
    schoolId: school.id, to: t.phone, kind: "staff-nudge",
    senderId: school.branding.smsSenderId, body: message,
  }]);
  revalidatePath(`/attendance/${classId}`);
  revalidatePath(`/attendance`);
  redirect(`/attendance/${classId}?flash=done`);
}

/** Latest nudge sent today for a class register (shows "reminded 10:42"). */
export async function lastNudgeToday(schoolId: string, classId: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [n] = await db.select().from(staffNudges)
    .where(and(eq(staffNudges.schoolId, schoolId), eq(staffNudges.refId, classId),
      eq(staffNudges.kind, "attendance")))
    .orderBy(desc(staffNudges.sentAt)).limit(1);
  return n && n.sentAt >= today ? n : null;
}
