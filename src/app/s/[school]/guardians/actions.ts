"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { guardians, students, studentGuardians } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { uid } from "@/lib/utils";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;
const PREFS = ["phone", "sms", "portal"];

async function ownGuardian(slug: string, id: string) {
  const { school } = await requireSchool(slug, ["admin"]);
  const [g] = await db.select().from(guardians)
    .where(and(eq(guardians.id, id), eq(guardians.schoolId, school.id)));
  if (!g) redirect("/guardians");
  return { school, g };
}

const touch = (guardianId: string, studentId?: string) => {
  revalidatePath("/guardians");
  revalidatePath(`/guardians/${guardianId}`);
  if (studentId) revalidatePath(`/students/${studentId}`);
};

/** Edit the guardian's own record — including the "how to reach them"
 *  preference that flags non-portal parents for the front desk. */
export async function updateGuardian(slug: string, id: string, f: FormData) {
  const { school, g } = await ownGuardian(slug, id);
  const phone = str(f, "phone") ?? g.phone;
  const pref = String(f.get("contactPref") ?? "");
  await db.update(guardians).set({
    name: str(f, "name") ?? g.name, phone,
    email: str(f, "email"), relation: str(f, "relation") ?? g.relation,
    occupation: str(f, "occupation"),
    contactPref: PREFS.includes(pref) ? pref : g.contactPref,
    note: str(f, "note"),
  }).where(and(eq(guardians.id, id), eq(guardians.schoolId, school.id)));
  touch(id);
  redirect(`/guardians/${id}?flash=saved`);
}

/** Link an existing student to this guardian (guardian-profile side). */
export async function linkChild(slug: string, guardianId: string, studentId: string) {
  const { school } = await ownGuardian(slug, guardianId);
  const [s] = await db.select({ id: students.id }).from(students)
    .where(and(eq(students.id, studentId), eq(students.schoolId, school.id)));
  if (!s) return;
  await db.insert(studentGuardians)
    .values({ studentId, guardianId, isPrimary: false }).onConflictDoNothing();
  touch(guardianId, studentId);
  redirect(`/guardians/${guardianId}?flash=linked`);
}

export async function unlinkChild(slug: string, guardianId: string, studentId: string) {
  await ownGuardian(slug, guardianId);
  await db.delete(studentGuardians).where(and(
    eq(studentGuardians.guardianId, guardianId), eq(studentGuardians.studentId, studentId)));
  touch(guardianId, studentId);
}

/** Exactly one primary contact per student: setting it clears the others. */
export async function setPrimaryGuardian(slug: string, guardianId: string, studentId: string) {
  const { school } = await ownGuardian(slug, guardianId);
  const [s] = await db.select({ id: students.id }).from(students)
    .where(and(eq(students.id, studentId), eq(students.schoolId, school.id)));
  if (!s) return;
  await db.update(studentGuardians).set({ isPrimary: false })
    .where(eq(studentGuardians.studentId, studentId));
  await db.update(studentGuardians).set({ isPrimary: true }).where(and(
    eq(studentGuardians.guardianId, guardianId), eq(studentGuardians.studentId, studentId)));
  touch(guardianId, studentId);
}

/** Add (or reuse by phone) a guardian and link them to a student — the same
 *  rule as the admission wizard, available from the Student File. */
export async function addGuardianToStudent(slug: string, studentId: string, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  const [s] = await db.select({ id: students.id }).from(students)
    .where(and(eq(students.id, studentId), eq(students.schoolId, school.id)));
  if (!s) return;
  const name = str(f, "name"), phone = str(f, "phone");
  if (!name || !phone) return;
  let [g] = await db.select().from(guardians)
    .where(and(eq(guardians.schoolId, school.id), eq(guardians.phone, phone)));
  if (!g) {
    const gid = uid();
    const pref = String(f.get("contactPref") ?? "");
    await db.insert(guardians).values({
      id: gid, schoolId: school.id, name, phone,
      email: str(f, "email"), relation: str(f, "relation") ?? "parent",
      occupation: str(f, "occupation"),
      contactPref: PREFS.includes(pref) ? pref : "phone",
    });
    [g] = await db.select().from(guardians).where(eq(guardians.id, gid));
  }
  await db.insert(studentGuardians)
    .values({ studentId, guardianId: g.id, isPrimary: f.get("isPrimary") === "on" })
    .onConflictDoNothing();
  touch(g.id, studentId);
}
