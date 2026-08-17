import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  guardians, studentGuardians, students, classes, attendanceRecords,
  feeInvoices, reportCards,
} from "@/db/schema";

/** A parent's children with the card data (doc 10: present? doing well? owing?). */
export async function getParentChildren(schoolId: string, userId: string, termId?: string) {
  const [g] = await db.select().from(guardians)
    .where(and(eq(guardians.schoolId, schoolId), eq(guardians.userId, userId)));
  if (!g) return [];
  const links = await db.select().from(studentGuardians).where(eq(studentGuardians.guardianId, g.id));
  if (!links.length) return [];
  const kids = await db.select({
    id: students.id, firstName: students.firstName, lastName: students.lastName,
    className: classes.name, classId: students.classId,
  }).from(students).leftJoin(classes, eq(students.classId, classes.id))
    .where(inArray(students.id, links.map((l) => l.studentId)));

  const today = new Date().toISOString().slice(0, 10);
  return Promise.all(kids.map(async (k) => {
    const [todayRec] = await db.select().from(attendanceRecords)
      .where(and(eq(attendanceRecords.studentId, k.id), eq(attendanceRecords.date, today)));
    const [inv] = termId
      ? await db.select().from(feeInvoices)
          .where(and(eq(feeInvoices.studentId, k.id), eq(feeInvoices.termId, termId)))
      : [undefined];
    const reports = await db.select({ id: reportCards.id, termId: reportCards.termId })
      .from(reportCards)
      .where(and(eq(reportCards.studentId, k.id), eq(reportCards.published, true)));
    return {
      ...k,
      today: todayRec?.status ?? null,
      feeDuePesewas: inv ? inv.totalPesewas - inv.paidPesewas : 0,
      invoiceId: inv?.id ?? null,
      reportTermIds: reports.map((r) => r.termId),
    };
  }));
}

/** Assert this user is a guardian of the student (parent child-page gate). */
export async function assertParentOf(schoolId: string, userId: string, studentId: string) {
  const [g] = await db.select().from(guardians)
    .where(and(eq(guardians.schoolId, schoolId), eq(guardians.userId, userId)));
  if (!g) return false;
  const [link] = await db.select().from(studentGuardians).where(and(
    eq(studentGuardians.guardianId, g.id), eq(studentGuardians.studentId, studentId)));
  return Boolean(link);
}

/** The student row behind a student login. */
export async function getStudentSelf(schoolId: string, userId: string) {
  const [s] = await db.select().from(students)
    .where(and(eq(students.schoolId, schoolId), eq(students.userId, userId)));
  return s ?? null;
}
