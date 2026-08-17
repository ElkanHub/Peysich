"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { applicants, classes, students, enrollments, academicYears, guardians, studentGuardians } from "@/db/schema";
import { requireModule } from "@/core/school-context";
import { uid } from "@/lib/utils";

export async function addApplicant(slug: string, f: FormData) {
  const { school } = await requireModule(slug, "admissions", ["admin"]);
  await db.insert(applicants).values({
    id: uid(), schoolId: school.id, name: String(f.get("name")),
    guardianName: String(f.get("guardianName") || "") || null,
    guardianPhone: String(f.get("guardianPhone")), levelId: String(f.get("levelId")),
  });
  revalidatePath(`/admissions`);
}

export async function setApplicantStatus(slug: string, id: string, status: string) {
  const { school } = await requireModule(slug, "admissions", ["admin"]);
  await db.update(applicants).set({ status })
    .where(and(eq(applicants.id, id), eq(applicants.schoolId, school.id)));
  revalidatePath(`/admissions`);
}

/** Convert applicant → enrolled student (doc 03: convert is the point). */
export async function admitApplicant(slug: string, id: string) {
  const { school } = await requireModule(slug, "admissions", ["admin"]);
  const [a] = await db.select().from(applicants)
    .where(and(eq(applicants.id, id), eq(applicants.schoolId, school.id)));
  if (!a) return;
  const [cls] = await db.select().from(classes)
    .where(and(eq(classes.schoolId, school.id), eq(classes.levelId, a.levelId)));
  if (!cls) return;
  const [n1, ...rest] = a.name.split(" ");
  const sidv = uid();
  const [{ n }] = await db.select({ n: students.id }).from(students)
    .where(eq(students.schoolId, school.id)).then((r) => [{ n: r.length }]);
  await db.insert(students).values({
    id: sidv, schoolId: school.id, admissionNo: `ADM${String(n + 1).padStart(4, "0")}`,
    firstName: n1, lastName: rest.join(" ") || n1, sex: "male", classId: cls.id,
  });
  const [year] = await db.select().from(academicYears)
    .where(and(eq(academicYears.schoolId, school.id), eq(academicYears.isCurrent, true)));
  if (year) await db.insert(enrollments).values({
    id: uid(), schoolId: school.id, studentId: sidv, yearId: year.id, classId: cls.id,
  }).onConflictDoNothing();
  if (a.guardianPhone) {
    const gid = uid();
    await db.insert(guardians).values({
      id: gid, schoolId: school.id, name: a.guardianName ?? "Guardian", phone: a.guardianPhone,
    });
    await db.insert(studentGuardians).values({ studentId: sidv, guardianId: gid }).onConflictDoNothing();
  }
  await db.update(applicants).set({ status: "admitted" }).where(eq(applicants.id, id));
  revalidatePath(`/admissions`);
}
