import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import * as XLSX from "xlsx";
import { db } from "@/db";
import {
  schools, students, guardians, studentGuardians, enrollments, classes, academicYears, terms,
  attendanceRecords, componentScores, feeInvoices, feePayments, staff,
} from "@/db/schema";
import { getSession } from "@/core/session";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Export everything (docs/11 §2.7): one workbook, one sheet per record kind,
 *  for the admin. A school that leaves takes its records with it; a school
 *  that stays has a backup it made itself. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const user = session.user as { role: string; schoolId?: string | null };
  if (user.role !== "admin" || !user.schoolId) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const sid = user.schoolId;
  const [school] = await db.select({ name: schools.name, slug: schools.slug }).from(schools).where(eq(schools.id, sid));
  if (!school) return NextResponse.json({ error: "No school" }, { status: 404 });

  const sheets: Record<string, unknown[]> = {
    Students: await db.select().from(students).where(eq(students.schoolId, sid)),
    Parents: await db.select().from(guardians).where(eq(guardians.schoolId, sid)),
    "Student-parent links": await db.select({ studentId: studentGuardians.studentId, guardianId: studentGuardians.guardianId, isPrimary: studentGuardians.isPrimary })
      .from(studentGuardians).innerJoin(students, eq(students.id, studentGuardians.studentId)).where(eq(students.schoolId, sid)),
    Classes: await db.select().from(classes).where(eq(classes.schoolId, sid)),
    Years: await db.select().from(academicYears).where(eq(academicYears.schoolId, sid)),
    Terms: await db.select({ id: terms.id, yearId: terms.yearId, name: terms.name, startsAt: terms.startsAt, endsAt: terms.endsAt, openedAt: terms.openedAt, closedAt: terms.closedAt, closedBy: terms.closedBy }).from(terms).where(eq(terms.schoolId, sid)),
    Enrolments: await db.select().from(enrollments).where(eq(enrollments.schoolId, sid)),
    Attendance: await db.select().from(attendanceRecords).where(eq(attendanceRecords.schoolId, sid)),
    Scores: await db.select().from(componentScores).where(eq(componentScores.schoolId, sid)),
    Invoices: await db.select().from(feeInvoices).where(eq(feeInvoices.schoolId, sid)),
    Payments: await db.select().from(feePayments).where(eq(feePayments.schoolId, sid)),
    Staff: await db.select({ id: staff.id, name: staff.name, email: staff.email, phone: staff.phone, staffRole: staff.staffRole, designation: staff.designation }).from(staff).where(eq(staff.schoolId, sid)),
  };
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.map(flat)), name.slice(0, 31));
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${school.slug}-schoolspec-${stamp}.xlsx"`,
    },
  });
}

/** Dates to ISO strings and nested objects to JSON so every cell is a value. */
function flat(row: unknown) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row as Record<string, unknown>))
    out[k] = v instanceof Date ? v.toISOString() : v && typeof v === "object" ? JSON.stringify(v) : v;
  return out;
}
