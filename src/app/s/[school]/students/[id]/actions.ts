"use server";
import { and, eq, ne, sql, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  students, studentFiles, studentItems, enrollments, academicYears,
  routeStudents, feeInvoices,
} from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { uid } from "@/lib/utils";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;

/** Update the student's full profile (the Student File's Profile tab). */
export async function updateStudent(slug: string, id: string, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  const admissionNo = str(f, "admissionNo");
  if (admissionNo) {
    const [dup] = await db.select({ id: students.id }).from(students).where(and(
      eq(students.schoolId, school.id), eq(students.admissionNo, admissionNo), ne(students.id, id)));
    if (dup) redirect(`/students/${id}/edit?err=admno`);
  }
  await db.update(students).set({
    ...(admissionNo ? { admissionNo } : {}),
    idNumber: str(f, "idNumber"),
    firstName: String(f.get("firstName")), lastName: String(f.get("lastName")),
    otherNames: str(f, "otherNames"), sex: String(f.get("sex")) as "male" | "female",
    dob: str(f, "dob"), placeOfBirth: str(f, "placeOfBirth"),
    nationality: str(f, "nationality"), hometown: str(f, "hometown"),
    religion: str(f, "religion"), address: str(f, "address"),
    previousSchool: str(f, "previousSchool"), bloodGroup: str(f, "bloodGroup"),
    medicalNotes: str(f, "medicalNotes"),
    emergencyName: str(f, "emergencyName"), emergencyPhone: str(f, "emergencyPhone"),
    classId: str(f, "classId"),
    boarding: f.get("boarding") === "on", admittedOn: str(f, "admittedOn"),
  }).where(and(eq(students.id, id), eq(students.schoolId, school.id)));
  revalidatePath(`/students/${id}`);
  redirect(`/students/${id}?flash=saved`);
}

/** ENROL an existing student: place them into a year + class. One enrolment
 *  row per (student, year) — re-enrolling the same year updates the placement
 *  instead of duplicating the child (add ≠ enrol). */
export async function enrollStudent(slug: string, id: string, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  const [s] = await db.select().from(students)
    .where(and(eq(students.id, id), eq(students.schoolId, school.id)));
  if (!s) return;
  const yearId = String(f.get("yearId") ?? ""), classId = String(f.get("classId") ?? "");
  if (!yearId || !classId) return;
  const [year] = await db.select().from(academicYears).where(and(
    eq(academicYears.id, yearId), eq(academicYears.schoolId, school.id)));
  if (!year) return;
  const status = String(f.get("enrollType") || "enrolled");
  await db.insert(enrollments)
    .values({ id: uid(), schoolId: school.id, studentId: id, yearId, classId, status })
    .onConflictDoUpdate({
      target: [enrollments.studentId, enrollments.yearId],
      set: { classId, status },
    });
  if (year.isCurrent) {
    const readmit = s.status === "left" || s.status === "alumni";
    await db.update(students).set({
      classId, boarding: f.get("boarding") === "on",
      // re-admission: same file, same history — status flips back and the
      // old exit record clears (it lives on in the closed enrolment rows)
      ...(readmit ? { status: "active", exitDate: null, exitReason: null,
        exitDestination: null, exitNote: null } : {}),
    }).where(eq(students.id, id));
  }
  revalidatePath(`/students/${id}`);
  redirect(`/students/${id}?tab=academics`);
}

const EXIT_REASONS = ["transferred", "withdrawn", "completed", "expelled", "other"] as const;

/** OFFBOARDING — a status transition, never a delete. History (attendance,
 *  reports, ledger, documents) stays intact under the same student id.
 *  Side effects: current-year enrolment closed with the exit reason,
 *  transport assignment released, drops off every active roster (all of
 *  them filter status = "active"), and the student portal goes read-only. */
export async function exitStudent(slug: string, id: string, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  const [s] = await db.select().from(students)
    .where(and(eq(students.id, id), eq(students.schoolId, school.id)));
  if (!s || s.status !== "active") redirect(`/students/${id}`);

  const reason = String(f.get("reason") ?? "");
  if (!(EXIT_REASONS as readonly string[]).includes(reason))
    redirect(`/students/${id}/exit?err=reason`);

  // clearance gate: outstanding fees / custody items need an explicit
  // acknowledgement — schools DO force-exit, but never silently
  const [[{ bal }], custody] = await Promise.all([
    db.select({ bal: sql<number>`coalesce(sum(total_pesewas - paid_pesewas), 0)` })
      .from(feeInvoices).where(and(
        eq(feeInvoices.schoolId, school.id), eq(feeInvoices.studentId, id))),
    db.select({ id: studentItems.id }).from(studentItems).where(and(
      eq(studentItems.studentId, id), isNull(studentItems.returnedAt))),
  ]);
  const hasIssues = Number(bal) > 0 || custody.length > 0;
  if (hasIssues && f.get("override") !== "on")
    redirect(`/students/${id}/exit?err=clearance`);

  const exitDate = String(f.get("exitDate") || "") || new Date().toISOString().slice(0, 10);
  await db.update(students).set({
    status: reason === "completed" ? "alumni" : "left",
    exitDate, exitReason: reason,
    exitDestination: str(f, "exitDestination"), exitNote: str(f, "exitNote"),
  }).where(and(eq(students.id, id), eq(students.schoolId, school.id)));

  // close the current year's enrolment with the reason (history, not deletion)
  const [year] = await db.select().from(academicYears).where(and(
    eq(academicYears.schoolId, school.id), eq(academicYears.isCurrent, true)));
  if (year) await db.update(enrollments)
    .set({ status: reason === "completed" ? "graduated" : reason })
    .where(and(eq(enrollments.studentId, id), eq(enrollments.yearId, year.id)));

  // release operational resources (assignments, not history)
  await db.delete(routeStudents).where(and(
    eq(routeStudents.studentId, id), eq(routeStudents.schoolId, school.id)));

  revalidatePath("/students");
  revalidatePath(`/students/${id}`);
  redirect(`/students/${id}?exited=1`);
}

/** Undo an exit recorded in error (distinct from re-admission, which is the
 *  Enrol flow and creates a fresh enrolment). */
export async function cancelExit(slug: string, id: string) {
  const { school } = await requireSchool(slug, ["admin"]);
  const [s] = await db.select().from(students)
    .where(and(eq(students.id, id), eq(students.schoolId, school.id)));
  if (!s || (s.status !== "left" && s.status !== "alumni") || !s.exitReason) return;
  await db.update(students).set({
    status: "active", exitDate: null, exitReason: null,
    exitDestination: null, exitNote: null,
  }).where(eq(students.id, id));
  const [year] = await db.select().from(academicYears).where(and(
    eq(academicYears.schoolId, school.id), eq(academicYears.isCurrent, true)));
  if (year) await db.update(enrollments).set({ status: "enrolled" })
    .where(and(eq(enrollments.studentId, id), eq(enrollments.yearId, year.id)));
  revalidatePath("/students");
  revalidatePath(`/students/${id}`);
}

export async function savePaymentNote(slug: string, id: string, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  await db.update(students).set({ paymentNote: str(f, "paymentNote") })
    .where(and(eq(students.id, id), eq(students.schoolId, school.id)));
  revalidatePath(`/students/${id}`);
  redirect(`/students/${id}?tab=fees&flash=saved`);
}

export async function setStudentPhoto(slug: string, id: string, fileKey: string) {
  const { school } = await requireSchool(slug, ["admin"]);
  if (!fileKey.startsWith(`school/${school.id}/`)) return { error: "Invalid file" };
  await db.update(students).set({ photoUrl: fileKey })
    .where(and(eq(students.id, id), eq(students.schoolId, school.id)));
  revalidatePath(`/students/${id}`);
  revalidatePath("/students/new");
  return { ok: true };
}

/** Attach a digital document (already uploaded to R2 via /api/upload). */
export async function addStudentFile(slug: string, id: string, payload: {
  kind: string; title: string; fileKey: string; note?: string;
}) {
  const { school, user } = await requireSchool(slug, ["admin"]);
  if (!payload.fileKey.startsWith(`school/${school.id}/`)) return { error: "Invalid file" };
  await db.insert(studentFiles).values({
    id: uid(), schoolId: school.id, studentId: id,
    kind: payload.kind, title: payload.title.slice(0, 120),
    fileKey: payload.fileKey, note: payload.note?.slice(0, 300) || null,
    uploadedBy: user.name,
  });
  revalidatePath(`/students/${id}`);
  revalidatePath("/students/new");
  return { ok: true };
}

/** Record a physical item taken into custody (originals, cards, etc.). */
export async function addStudentItem(slug: string, id: string, f: FormData) {
  const { school, user } = await requireSchool(slug, ["admin"]);
  const itemName = str(f, "itemName"), location = str(f, "location");
  if (!itemName || !location) return;
  await db.insert(studentItems).values({
    id: uid(), schoolId: school.id, studentId: id,
    itemName, location, receivedFrom: str(f, "receivedFrom"),
    note: str(f, "note"), receivedBy: user.name,
  });
  revalidatePath(`/students/${id}`);
  revalidatePath("/students/new");
}

export async function returnStudentItem(slug: string, id: string, itemId: string, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  await db.update(studentItems).set({
    returnedAt: new Date(), returnedTo: str(f, "returnedTo") ?? "guardian",
  }).where(and(eq(studentItems.id, itemId), eq(studentItems.schoolId, school.id)));
  revalidatePath(`/students/${id}`);
}
