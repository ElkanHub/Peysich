import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  academicYears, classes, staff, students, attendanceRecords, feeInvoices, user, schools,
} from "@/db/schema";

export type Stage = { key: string; label: string; done: boolean };

/** Where a school is in onboarding — the platform's funnel view (per school). */
export async function getOnboardingStages(schoolId: string): Promise<Stage[]> {
  const cnt = async (q: Promise<{ n: number }[]>) => Number((await q)[0]?.n ?? 0);
  // installed and trained by SchoolSpec: we did the setup, so every step is done
  const [s] = await db.select({ installation: schools.installation }).from(schools).where(eq(schools.id, schoolId));
  const ours = s?.installation === "done";
  const [yr, cl, sf, st, att, inv] = await Promise.all([
    cnt(db.select({ n: sql<number>`count(*)` }).from(academicYears).where(eq(academicYears.schoolId, schoolId))),
    cnt(db.select({ n: sql<number>`count(*)` }).from(classes).where(eq(classes.schoolId, schoolId))),
    cnt(db.select({ n: sql<number>`count(*)` }).from(staff).where(eq(staff.schoolId, schoolId))),
    cnt(db.select({ n: sql<number>`count(*)` }).from(students).where(and(eq(students.schoolId, schoolId), eq(students.status, "active")))),
    cnt(db.select({ n: sql<number>`count(*)` }).from(attendanceRecords).where(eq(attendanceRecords.schoolId, schoolId))),
    cnt(db.select({ n: sql<number>`count(*)` }).from(feeInvoices).where(eq(feeInvoices.schoolId, schoolId))),
  ]);
  return [
    { key: "year", label: "Academic year", done: ours || yr > 0 },
    { key: "classes", label: "Classes", done: ours || cl > 0 },
    { key: "staff", label: "Staff", done: ours || sf > 0 },
    { key: "students", label: "Students", done: ours || st > 0 },
    { key: "attendance", label: "First register", done: ours || att > 0 },
    { key: "fees", label: "First invoices", done: ours || inv > 0 },
  ];
}

/** The people behind a school (admin contacts first). */
export async function getSchoolUsers(schoolId: string) {
  return db.select({
    id: user.id, name: user.name, email: user.email, role: user.role,
    phone: user.phone, createdAt: user.createdAt,
  }).from(user).where(eq(user.schoolId, schoolId))
    .orderBy(sql`case when role='admin' then 0 when role='teacher' then 1 else 2 end`, user.createdAt);
}
