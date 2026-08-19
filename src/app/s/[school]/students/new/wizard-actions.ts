"use server";
import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  students, guardians, studentGuardians, enrollments, academicYears,
  classes, feeStructures, feeInvoices,
} from "@/db/schema";
import { requireSchool, getCurrentTerm } from "@/core/school-context";
import { createSchoolLogin } from "@/core/accounts";
import { uid } from "@/lib/utils";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;
const wiz = (id: string, step: number) => `/students/new?draft=${id}&step=${step}`;

/** Stage 1 — identity & contact. Creates the DRAFT student (invisible to
 *  rosters, registers and caps until admission completes). */
export async function startAdmission(slug: string, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  const firstName = str(f, "firstName"), lastName = str(f, "lastName");
  if (!firstName || !lastName) redirect(`/students/new?err=name`);
  const [{ act }] = await db.select({ act: sql<number>`count(*)` }).from(students)
    .where(and(eq(students.schoolId, school.id), eq(students.status, "active")));
  if (Number(act) >= school.studentCap) redirect(`/students/new?err=cap`);
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(students)
    .where(eq(students.schoolId, school.id));
  const id = uid();
  await db.insert(students).values({
    id, schoolId: school.id,
    admissionNo: `ADM${String(Number(n) + 1).padStart(4, "0")}`,
    firstName, lastName, otherNames: str(f, "otherNames"),
    sex: String(f.get("sex")) as "male" | "female",
    dob: str(f, "dob"), placeOfBirth: str(f, "placeOfBirth"),
    nationality: str(f, "nationality"), hometown: str(f, "hometown"),
    religion: str(f, "religion"), address: str(f, "address"),
    status: "draft", admissionStep: 1,
  });
  redirect(wiz(id, 2));
}

async function draftOf(slug: string, id: string) {
  const { school } = await requireSchool(slug, ["admin"]);
  const [s] = await db.select().from(students)
    .where(and(eq(students.id, id), eq(students.schoolId, school.id)));
  if (!s) redirect(`/students/new`);
  return { school, s };
}

const bump = (s: { admissionStep: number | null }, step: number) =>
  ({ admissionStep: Math.max(s.admissionStep ?? 0, step) });

/** Stage 1 (revisited) — edit identity on an existing draft. */
export async function saveIdentity(slug: string, id: string, f: FormData) {
  const { school, s } = await draftOf(slug, id);
  await db.update(students).set({
    firstName: str(f, "firstName") ?? s.firstName, lastName: str(f, "lastName") ?? s.lastName,
    otherNames: str(f, "otherNames"), sex: String(f.get("sex")) as "male" | "female",
    dob: str(f, "dob"), placeOfBirth: str(f, "placeOfBirth"),
    nationality: str(f, "nationality"), hometown: str(f, "hometown"),
    religion: str(f, "religion"), address: str(f, "address"),
    ...bump(s, 1),
  }).where(and(eq(students.id, id), eq(students.schoolId, school.id)));
  redirect(wiz(id, 2));
}

/** Stage 2 — academic & enrollment details. */
export async function savePlacement(slug: string, id: string, f: FormData) {
  const { school, s } = await draftOf(slug, id);
  const admissionNo = str(f, "admissionNo") ?? s.admissionNo;
  const [dup] = await db.select({ id: students.id }).from(students).where(and(
    eq(students.schoolId, school.id), eq(students.admissionNo, admissionNo), ne(students.id, id)));
  if (dup) redirect(wiz(id, 2) + "&err=admno");
  await db.update(students).set({
    admissionNo, classId: str(f, "classId"),
    admittedOn: str(f, "admittedOn"), boarding: f.get("boarding") === "on",
    previousSchool: str(f, "previousSchool"), ...bump(s, 2),
  }).where(and(eq(students.id, id), eq(students.schoolId, school.id)));
  redirect(wiz(id, 3));
}

/** Stage 3 — link a guardian (dedupes on phone so siblings share one parent). */
export async function addAdmissionGuardian(slug: string, id: string, f: FormData) {
  const { school } = await draftOf(slug, id);
  const name = str(f, "name"), phone = str(f, "phone");
  if (!name || !phone) redirect(wiz(id, 3));
  let [g] = await db.select().from(guardians)
    .where(and(eq(guardians.schoolId, school.id), eq(guardians.phone, phone)));
  if (!g) {
    const gid = uid();
    await db.insert(guardians).values({
      id: gid, schoolId: school.id, name, phone,
      email: str(f, "email"), relation: str(f, "relation") ?? "parent",
    });
    [g] = await db.select().from(guardians).where(eq(guardians.id, gid));
  }
  await db.insert(studentGuardians)
    .values({ studentId: id, guardianId: g.id, isPrimary: f.get("isPrimary") === "on" })
    .onConflictDoNothing();
  revalidatePath("/students/new");
  redirect(wiz(id, 3));
}

export async function removeAdmissionGuardian(slug: string, id: string, guardianId: string) {
  await draftOf(slug, id);
  await db.delete(studentGuardians).where(and(
    eq(studentGuardians.studentId, id), eq(studentGuardians.guardianId, guardianId)));
  revalidatePath("/students/new");
  redirect(wiz(id, 3));
}

/** Stage 3 footer — emergency contact & pickup note, then continue. */
export async function saveEmergency(slug: string, id: string, f: FormData) {
  const { school, s } = await draftOf(slug, id);
  await db.update(students).set({
    emergencyName: str(f, "emergencyName"), emergencyPhone: str(f, "emergencyPhone"),
    ...bump(s, 3),
  }).where(and(eq(students.id, id), eq(students.schoolId, school.id)));
  redirect(wiz(id, 4));
}

/** Stage 4 — health & medical. */
export async function saveHealth(slug: string, id: string, f: FormData) {
  const { school, s } = await draftOf(slug, id);
  await db.update(students).set({
    bloodGroup: str(f, "bloodGroup"), medicalNotes: str(f, "medicalNotes"),
    ...bump(s, 4),
  }).where(and(eq(students.id, id), eq(students.schoolId, school.id)));
  redirect(wiz(id, 5));
}

/** Stages 5 (documents happen via uploaders/custody forms) & 6 footer. */
export async function advanceStep(slug: string, id: string, from: number, f: FormData) {
  const { school, s } = await draftOf(slug, id);
  await db.update(students).set({
    ...(from === 6 ? { paymentNote: str(f, "paymentNote") } : {}),
    ...bump(s, from),
  }).where(and(eq(students.id, id), eq(students.schoolId, school.id)));
  redirect(wiz(id, from + 1));
}

/** Stage 7 — review & provisioning: activate, enrol, bill, issue login. */
export async function completeAdmission(slug: string, id: string, f: FormData) {
  const { school, s } = await draftOf(slug, id);
  if (!s.classId) redirect(wiz(id, 2) + "&err=noclass");
  const [{ act }] = await db.select({ act: sql<number>`count(*)` }).from(students)
    .where(and(eq(students.schoolId, school.id), eq(students.status, "active")));
  if (Number(act) >= school.studentCap) redirect(wiz(id, 7) + "&err=cap");

  await db.update(students).set({
    status: "active", admissionStep: null,
    admittedOn: s.admittedOn ?? new Date().toISOString().slice(0, 10),
  }).where(and(eq(students.id, id), eq(students.schoolId, school.id)));

  const [year] = await db.select().from(academicYears)
    .where(and(eq(academicYears.schoolId, school.id), eq(academicYears.isCurrent, true)));
  if (year) await db.insert(enrollments).values({
    id: uid(), schoolId: school.id, studentId: id, yearId: year.id, classId: s.classId,
  }).onConflictDoNothing();

  if (f.get("raiseInvoice") === "on") {
    const term = await getCurrentTerm(school.id);
    const [cls] = await db.select().from(classes).where(eq(classes.id, s.classId));
    if (term && cls) {
      const items = await db.select().from(feeStructures).where(and(
        eq(feeStructures.schoolId, school.id), eq(feeStructures.termId, term.id),
        eq(feeStructures.levelId, cls.levelId)));
      const total = items.reduce((a, it) => a + it.amountPesewas, 0);
      if (total) await db.insert(feeInvoices)
        .values({ id: uid(), schoolId: school.id, studentId: id, termId: term.id, totalPesewas: total })
        .onConflictDoNothing();
    }
  }

  if (f.get("issueLogin") === "on" && !s.userId) {
    const r = await createSchoolLogin({
      schoolId: school.id, schoolSlug: school.slug,
      name: `${s.firstName} ${s.lastName}`, role: "student",
      username: s.admissionNo.toLowerCase(),
    });
    if (!("error" in r))
      await db.update(students).set({ userId: r.userId }).where(eq(students.id, id));
  }

  revalidatePath("/students");
  redirect(`/students/${id}`);
}

/** Abandon an in-progress admission (drafts only — active students are safe). */
export async function discardAdmission(slug: string, id: string) {
  const { school } = await requireSchool(slug, ["admin"]);
  await db.delete(students).where(and(
    eq(students.id, id), eq(students.schoolId, school.id), eq(students.status, "draft")));
  revalidatePath("/students");
  redirect("/students");
}
