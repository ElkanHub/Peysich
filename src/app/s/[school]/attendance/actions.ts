"use server";
import { and, eq, desc, gte, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { attendanceRecords, students, classes, staff, staffNudges, terms } from "@/db/schema";
import { requireModule, getTeacherScope } from "@/core/school-context";
import { inTerm, listTerms, schoolWritable, termWritable, whyNotWritable } from "@/core/terms";
import { getHolidayMap, isWeekend } from "@/core/calendar";
import { uid } from "@/lib/utils";
import { withFlash } from "@/lib/flash";

/** Save a class register. Default-present: form posts only exceptions,
 *  everyone else is recorded present. Idempotent per (student, date).
 *  RIGHTS: the class teacher marks their homeroom (today only); an admin may
 *  mark on the teacher's behalf and correct PAST days from the record book.
 *  Weekends and marked holidays are never school days — refused outright. */
export async function saveRegister(slug: string, classId: string, f: FormData) {
  const { school, user } = await requireModule(slug, "attendance", ["admin", "teacher"]);
  if (user.role === "teacher") {
    const scope = await getTeacherScope(school.id, user.id);
    if (!scope?.homeroomIds.has(classId))
      throw new Error("Only the class teacher marks this register");
  }
  const today = new Date().toISOString().slice(0, 10);
  const dateRaw = String(f.get("date") || today);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : today;
  // guards return (never throw) so the register screen can route to the
  // friendly message instead of a crash
  // corrections to other days are an admin-only, past-only move
  if (date !== today && (user.role === "teacher" || date > today))
    return { err: "notallowed" as const };
  if (isWeekend(date)) return { err: "weekend" as const };
  const holidayMap = await getHolidayMap(school.id);
  if (holidayMap.has(date)) return { err: "holiday" as const };

  // the record belongs to the term whose dates contain it, and only a term
  // that can still take writes (open, or ended within the correction window)
  if (!schoolWritable(school.status)) return { err: "term" as const, msg: "The school's subscription has ended. Records are kept and readable; renew to mark registers again." };
  const allTerms = await listTerms(school.id);
  const term = allTerms.find((t) => inTerm(t, date));
  if (!term) return { err: "term" as const, msg: "That day is outside every term's dates. Check the term dates under School settings." };
  if (!termWritable(term)) return { err: "term" as const, msg: whyNotWritable(term) };

  const roster = await db.select({ id: students.id }).from(students)
    .where(and(eq(students.schoolId, school.id), eq(students.classId, classId),
      eq(students.status, "active")));
  const ids = roster.map((r) => r.id);
  if (!ids.length) return { told: 0, absent: 0 };

  // what was saved before — so a correction only texts the NEWLY absent
  const where = and(
    eq(attendanceRecords.schoolId, school.id), eq(attendanceRecords.date, date),
    inArray(attendanceRecords.studentId, ids));
  const before = new Map((await db.select({ sid: attendanceRecords.studentId, status: attendanceRecords.status })
    .from(attendanceRecords).where(where)).map((r) => [r.sid, r.status]));
  const status = (sidv: string) => String(f.get(`st_${sidv}`) || "present");

  await db.delete(attendanceRecords).where(where);
  await db.insert(attendanceRecords).values(ids.map((sidv) => ({
    id: uid(), schoolId: school.id, studentId: sidv, classId, termId: term.id,
    date, status: status(sidv), markedBy: user.id,
  })));
  // absence alerts → guardians (today only; only children who were not
  // already recorded absent — correcting one child never re-texts everyone)
  const absentAll = ids.filter((sidv) => status(sidv) === "absent");
  const absent = date === today ? absentAll.filter((sidv) => before.get(sidv) !== "absent") : [];
  let told = 0;
  if (absent.length) {
    const { guardians, studentGuardians } = await import("@/db/schema");
    const gs = await db.select({ id: guardians.id, sid: studentGuardians.studentId })
      .from(studentGuardians)
      .innerJoin(guardians, eq(studentGuardians.guardianId, guardians.id))
      .where(inArray(studentGuardians.studentId, absent));
    const names = new Map((await db.select().from(students)
      .where(inArray(students.id, absent))).map((s) => [s.id, s.firstName]));
    const { notifyMany } = await import("@/messaging/notify");
    const r = await notifyMany(school, gs.map((g) => ({
      to: { kind: "guardian", id: g.id }, kind: "absence", url: "/attendance",
      vars: { child: names.get(g.sid), office: school.branding.phone },
    })));
    told = r.sent + r.free;
  }
  revalidatePath(`/attendance`);
  revalidatePath(`/attendance/register`);
  revalidatePath(`/attendance/${classId}`);
  return { told, absent: absentAll.length };
}

/** Admin nudge: "the register isn't marked yet" — SMS/email to the class
 *  teacher (real once Arkesel/Resend keys exist, queued meanwhile) AND a
 *  banner on their dashboard until the register is saved. */
export async function remindClassTeacher(slug: string, classId: string, f?: FormData) {
  const { school, user } = await requireModule(slug, "attendance", ["admin"]);
  // the overview wall and the class page both host this button — return the
  // admin to wherever they pressed it
  const back = f?.get("from") === "wall" ? `/attendance` : `/attendance/${classId}`;
  const [cls] = await db.select().from(classes)
    .where(and(eq(classes.id, classId), eq(classes.schoolId, school.id)));
  const noTeacher = withFlash(back,
    "This class has no class teacher yet — assign one on Teaching & allocations first.", { error: true });
  const responsibleId = cls?.formMasterId ?? cls?.classTeacherId;
  if (!responsibleId) redirect(noTeacher);
  const [t] = await db.select().from(staff).where(eq(staff.id, responsibleId!));
  if (!t) redirect(noTeacher);
  const first = t.name.split(" ")[0];

  const { notify } = await import("@/messaging/notify");
  const { render } = await import("@/messaging/render");
  const { schoolUrl } = await import("@/messaging/render");
  const vars = { school: school.name, first, class: cls.name };
  await db.insert(staffNudges).values({
    id: uid(), schoolId: school.id, staffId: t.id,
    kind: "attendance", refId: classId, message: render("staff_nudge_register", vars), sentBy: user.name,
  });
  // the app and Telegram free, then WhatsApp or SMS — one door
  await notify({
    school, to: { kind: "staff", id: t.id }, kind: "staff_nudge_register", vars,
    url: `/attendance/${classId}`, link: schoolUrl(slug, `/attendance/${classId}`),
  });
  revalidatePath(`/attendance/${classId}`);
  revalidatePath(`/attendance`);
  redirect(withFlash(back, `Reminder sent to ${first}.`));
}

/** All attendance nudges sent today, latest per class — powers the
 *  "reminded 10:42" chips on the monitoring wall in one query. */
export async function nudgesTodayByClass(schoolId: string) {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const rows = await db.select().from(staffNudges)
    .where(and(eq(staffNudges.schoolId, schoolId), eq(staffNudges.kind, "attendance"),
      gte(staffNudges.sentAt, start)))
    .orderBy(desc(staffNudges.sentAt));
  const latest = new Map<string, Date>();
  for (const n of rows) if (n.refId && !latest.has(n.refId)) latest.set(n.refId, n.sentAt);
  return latest;
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
