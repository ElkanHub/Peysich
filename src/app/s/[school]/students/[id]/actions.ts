"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { students, studentFiles, studentItems } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { uid } from "@/lib/utils";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;

/** Update the student's full profile (the Student File's Profile tab). */
export async function updateStudent(slug: string, id: string, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  await db.update(students).set({
    firstName: String(f.get("firstName")), lastName: String(f.get("lastName")),
    otherNames: str(f, "otherNames"), sex: String(f.get("sex")) as "male" | "female",
    dob: str(f, "dob"), placeOfBirth: str(f, "placeOfBirth"),
    nationality: str(f, "nationality"), hometown: str(f, "hometown"),
    religion: str(f, "religion"), address: str(f, "address"),
    previousSchool: str(f, "previousSchool"), bloodGroup: str(f, "bloodGroup"),
    medicalNotes: str(f, "medicalNotes"),
    emergencyName: str(f, "emergencyName"), emergencyPhone: str(f, "emergencyPhone"),
    classId: str(f, "classId"),
  }).where(and(eq(students.id, id), eq(students.schoolId, school.id)));
  revalidatePath(`/students/${id}`);
  redirect(`/students/${id}`);
}

export async function savePaymentNote(slug: string, id: string, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  await db.update(students).set({ paymentNote: str(f, "paymentNote") })
    .where(and(eq(students.id, id), eq(students.schoolId, school.id)));
  revalidatePath(`/students/${id}`);
}

export async function setStudentPhoto(slug: string, id: string, fileKey: string) {
  const { school } = await requireSchool(slug, ["admin"]);
  if (!fileKey.startsWith(`school/${school.id}/`)) return { error: "Invalid file" };
  await db.update(students).set({ photoUrl: fileKey })
    .where(and(eq(students.id, id), eq(students.schoolId, school.id)));
  revalidatePath(`/students/${id}`);
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
}

export async function returnStudentItem(slug: string, id: string, itemId: string, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  await db.update(studentItems).set({
    returnedAt: new Date(), returnedTo: str(f, "returnedTo") ?? "guardian",
  }).where(and(eq(studentItems.id, itemId), eq(studentItems.schoolId, school.id)));
  revalidatePath(`/students/${id}`);
}
