"use server";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { students, classes, guardians, studentGuardians, enrollments, academicYears } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { uid } from "@/lib/utils";

export type ImportRow = {
  firstName: string; lastName: string; otherNames?: string; sex: string;
  dob?: string; className: string; admissionNo?: string; admittedOn?: string;
  boarder?: string; idNumber?: string; placeOfBirth?: string; nationality?: string;
  hometown?: string; religion?: string; address?: string; previousSchool?: string;
  bloodGroup?: string; medicalNotes?: string;
  guardianName?: string; guardianPhone?: string; guardianRelation?: string;
  guardianOccupation?: string; guardianEmail?: string;
  emergencyName?: string; emergencyPhone?: string; paymentNote?: string;
};

const t = (v?: string) => (v ?? "").trim() || null;
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Bulk install: rows parsed from the Excel collection sheet, validated and
 *  written per-row — valid rows import, broken rows are reported by line. */
export async function importStudentRows(slug: string, rows: ImportRow[]) {
  const { school } = await requireSchool(slug, ["admin"]);
  if (!Array.isArray(rows) || rows.length === 0) return { error: "No rows found in the sheet" };
  if (rows.length > 2000) return { error: "Sheet too large — import in batches of 2,000" };

  const [cls, existing, [{ act }], [year]] = await Promise.all([
    db.select().from(classes).where(eq(classes.schoolId, school.id)),
    db.select({ admissionNo: students.admissionNo }).from(students)
      .where(eq(students.schoolId, school.id)),
    db.select({ act: sql<number>`count(*)` }).from(students)
      .where(and(eq(students.schoolId, school.id), eq(students.status, "active"))),
    db.select().from(academicYears)
      .where(and(eq(academicYears.schoolId, school.id), eq(academicYears.isCurrent, true))),
  ]);
  const classByName = new Map(cls.map((c) => [c.name.trim().toLowerCase(), c]));
  const usedAdm = new Set(existing.map((e) => e.admissionNo.toLowerCase()));
  let admCounter = existing.length;
  const nextAdm = () => {
    let a; do { a = `ADM${String(++admCounter).padStart(4, "0")}`; } while (usedAdm.has(a.toLowerCase()));
    return a;
  };
  const guardianCache = new Map<string, string>(); // phone → id

  const errors: string[] = [];
  let imported = 0;
  const capLeft = school.studentCap - Number(act);
  if (rows.length > capLeft)
    return { error: `Sheet has ${rows.length} students but your plan allows ${capLeft} more — upgrade in Billing first` };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], line = i + 2; // +2: header row + 1-index, matches Excel
    const firstName = t(r.firstName), lastName = t(r.lastName);
    const sexRaw = (r.sex ?? "").trim().toLowerCase();
    const sex = sexRaw.startsWith("m") ? "male" : sexRaw.startsWith("f") ? "female" : null;
    const cl = classByName.get((r.className ?? "").trim().toLowerCase());
    if (!firstName || !lastName) { errors.push(`Row ${line}: first and last name are required`); continue; }
    if (!sex) { errors.push(`Row ${line}: sex must be male or female`); continue; }
    if (!cl) { errors.push(`Row ${line}: class "${r.className}" not found — use a name from the Classes sheet`); continue; }
    const dob = t(r.dob), admittedOn = t(r.admittedOn);
    if (dob && !isDate(dob)) { errors.push(`Row ${line}: date of birth must be YYYY-MM-DD`); continue; }
    if (admittedOn && !isDate(admittedOn)) { errors.push(`Row ${line}: admission date must be YYYY-MM-DD`); continue; }
    let admissionNo = t(r.admissionNo);
    if (admissionNo && usedAdm.has(admissionNo.toLowerCase())) {
      errors.push(`Row ${line}: admission no ${admissionNo} already exists`); continue;
    }
    admissionNo = admissionNo ?? nextAdm();
    usedAdm.add(admissionNo.toLowerCase());

    const id = uid();
    await db.insert(students).values({
      id, schoolId: school.id, admissionNo, firstName, lastName,
      otherNames: t(r.otherNames), sex, dob, classId: cl.id,
      admittedOn, boarding: /^(y|yes|true|boarder|1)$/i.test((r.boarder ?? "").trim()),
      idNumber: t(r.idNumber), placeOfBirth: t(r.placeOfBirth),
      nationality: t(r.nationality), hometown: t(r.hometown), religion: t(r.religion),
      address: t(r.address), previousSchool: t(r.previousSchool),
      bloodGroup: t(r.bloodGroup), medicalNotes: t(r.medicalNotes),
      emergencyName: t(r.emergencyName), emergencyPhone: t(r.emergencyPhone),
      paymentNote: t(r.paymentNote),
    });
    if (year) await db.insert(enrollments).values({
      id: uid(), schoolId: school.id, studentId: id, yearId: year.id, classId: cl.id,
    }).onConflictDoNothing();

    const gName = t(r.guardianName), gPhone = t(r.guardianPhone);
    if (gName && gPhone) {
      let gid = guardianCache.get(gPhone);
      if (!gid) {
        const [g] = await db.select().from(guardians)
          .where(and(eq(guardians.schoolId, school.id), eq(guardians.phone, gPhone)));
        if (g) gid = g.id;
        else {
          gid = uid();
          await db.insert(guardians).values({
            id: gid, schoolId: school.id, name: gName, phone: gPhone,
            relation: t(r.guardianRelation) ?? "parent",
            occupation: t(r.guardianOccupation), email: t(r.guardianEmail),
          });
        }
        guardianCache.set(gPhone, gid);
      }
      await db.insert(studentGuardians).values({ studentId: id, guardianId: gid }).onConflictDoNothing();
    }
    imported++;
  }

  revalidatePath("/students");
  return { imported, errors };
}
