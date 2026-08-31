"use server";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import {
  academicYears, terms, levels, classes, subjects, staff, students,
  guardians, studentGuardians, enrollments, schools,
} from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { uid } from "@/lib/utils";

/* All actions are scoped: requireSchool(slug, roles) first, school.id injected
   into every query. slug comes from the page (bound), never from user input. */

// ── Academic setup ──
export async function createYear(slug: string, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  const yearId = uid();
  await db.insert(academicYears).values({
    id: yearId, schoolId: school.id, name: String(f.get("name")),
    startsAt: String(f.get("startsAt")), endsAt: String(f.get("endsAt")), isCurrent: true,
  });
  await db.update(academicYears).set({ isCurrent: false })
    .where(and(eq(academicYears.schoolId, school.id), sql`${academicYears.id} != ${yearId}`));
  // 3 default terms, editable
  const s = new Date(String(f.get("startsAt"))), e = new Date(String(f.get("endsAt")));
  const third = (e.getTime() - s.getTime()) / 3;
  const d = (t: number) => new Date(t).toISOString().slice(0, 10);
  await db.insert(terms).values([1, 2, 3].map((n) => ({
    id: uid(), schoolId: school.id, yearId, name: `Term ${n}`,
    startsAt: d(s.getTime() + third * (n - 1)), endsAt: d(s.getTime() + third * n),
    isCurrent: n === 1,
  })));
  revalidatePath(`/settings`);
}

export async function setCurrentTerm(slug: string, termId: string) {
  const { school } = await requireSchool(slug, ["admin"]);
  await db.update(terms).set({ isCurrent: false }).where(eq(terms.schoolId, school.id));
  await db.update(terms).set({ isCurrent: true })
    .where(and(eq(terms.id, termId), eq(terms.schoolId, school.id)));
  revalidatePath(`/settings`);
}

import { LEVEL_TEMPLATE } from "@/lib/levels";

/** Seed ticked levels + one class each + GES-typical subjects (edit > create). */
export async function setupLevels(slug: string, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  const picked = LEVEL_TEMPLATE.filter(([code]) => f.get(`lv_${code}`));
  for (let i = 0; i < picked.length; i++) {
    const [code, name, preschool] = picked[i];
    const levelId = uid();
    await db.insert(levels).values({ id: levelId, schoolId: school.id, code, name, sortOrder: i, preschool })
      .onConflictDoNothing();
    const [lv] = await db.select().from(levels)
      .where(and(eq(levels.schoolId, school.id), eq(levels.code, code)));
    const existing = await db.select({ id: classes.id }).from(classes)
      .where(and(eq(classes.schoolId, school.id), eq(classes.levelId, lv.id)));
    if (!existing.length)
      await db.insert(classes).values({ id: uid(), schoolId: school.id, levelId: lv.id, name: `${name} A` });
  }
  const GES = ["English Language", "Mathematics", "Science", "Our World Our People",
    "Religious & Moral Education", "Creative Arts", "Ghanaian Language", "Computing",
    "Career Technology", "Social Studies", "French"];
  await db.insert(subjects).values(GES.map((name) => ({ id: uid(), schoolId: school.id, name })))
    .onConflictDoNothing();
  revalidatePath(`/settings`);
}

export async function addClass(slug: string, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  await db.insert(classes).values({
    id: uid(), schoolId: school.id, levelId: String(f.get("levelId")), name: String(f.get("name")),
  });
  revalidatePath(`/settings`);
}

export async function saveBranding(slug: string, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  await db.update(schools).set({
    branding: {
      ...school.branding,
      motto: String(f.get("motto") ?? ""), address: String(f.get("address") ?? ""),
      phone: String(f.get("phone") ?? ""), email: String(f.get("email") ?? ""),
      primaryColor: String(f.get("primaryColor") ?? ""),
      smsSenderId: String(f.get("smsSenderId") ?? ""),
    },
    updatedAt: new Date(),
  }).where(eq(schools.id, school.id));
  // the school object is cached per-tenant — without this, the new colour
  // saves but every page (and every paper) keeps serving the old branding
  const { invalidateSchool } = await import("@/core/tenant");
  invalidateSchool(slug);
  revalidatePath(`/settings`);
  redirect(`/settings?flash=saved`);
}

// ── People ──
const studentSchema = z.object({
  firstName: z.string().min(1), lastName: z.string().min(1),
  sex: z.enum(["male", "female"]), classId: z.string().min(1),
  admissionNo: z.string().optional(), dob: z.string().optional(),
  guardianName: z.string().optional(), guardianPhone: z.string().optional(),
});

export async function createStudent(slug: string, _: unknown, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  const p = studentSchema.safeParse(Object.fromEntries(f));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(students)
    .where(eq(students.schoolId, school.id));
  const [{ act }] = await db.select({ act: sql<number>`count(*)` }).from(students)
    .where(and(eq(students.schoolId, school.id), eq(students.status, "active")));
  if (Number(act) >= school.studentCap)
    return { error: `Student limit reached (${school.studentCap} on your plan) — upgrade in Billing to add more` };
  const id = uid();
  await db.insert(students).values({
    id, schoolId: school.id,
    admissionNo: d.admissionNo || `ADM${String(Number(n) + 1).padStart(4, "0")}`,
    firstName: d.firstName, lastName: d.lastName, sex: d.sex,
    dob: d.dob || null, classId: d.classId,
  });
  const [year] = await db.select().from(academicYears)
    .where(and(eq(academicYears.schoolId, school.id), eq(academicYears.isCurrent, true)));
  if (year) await db.insert(enrollments).values({
    id: uid(), schoolId: school.id, studentId: id, yearId: year.id, classId: d.classId,
  }).onConflictDoNothing();
  if (d.guardianName && d.guardianPhone) {
    let [g] = await db.select().from(guardians)
      .where(and(eq(guardians.schoolId, school.id), eq(guardians.phone, d.guardianPhone)));
    if (!g) {
      const gid = uid();
      await db.insert(guardians).values({ id: gid, schoolId: school.id, name: d.guardianName, phone: d.guardianPhone });
      [g] = await db.select().from(guardians).where(eq(guardians.id, gid));
    }
    await db.insert(studentGuardians).values({ studentId: id, guardianId: g.id }).onConflictDoNothing();
  }
  revalidatePath(`/students`);
  return { ok: true };
}

export async function createStaff(slug: string, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  await db.insert(staff).values({
    id: uid(), schoolId: school.id, name: String(f.get("name")),
    email: String(f.get("email") || "") || null, phone: String(f.get("phone") || "") || null,
    staffRole: String(f.get("staffRole") || "teacher"),
  });
  revalidatePath(`/staff`);
}

/** CSV import: firstName,lastName,sex,className,guardianName,guardianPhone
 *  Per-row errors reported; valid rows imported (doc 10). */
export async function importStudents(slug: string, _: unknown, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  const text = String(f.get("csv") ?? "").trim();
  if (!text) return { error: "Paste CSV rows first" };
  const cls = await db.select().from(classes).where(eq(classes.schoolId, school.id));
  const byName = new Map(cls.map((c) => [c.name.toLowerCase(), c.id]));
  const errors: string[] = []; let ok = 0;
  const rows = text.split(/\r?\n/).filter(Boolean);
  const start = /first/i.test(rows[0]) ? 1 : 0; // skip header row
  for (let i = start; i < rows.length; i++) {
    const [firstName, lastName, sex, className, guardianName, guardianPhone] =
      rows[i].split(",").map((s) => s?.trim());
    const classId = byName.get((className ?? "").toLowerCase());
    if (!firstName || !lastName) { errors.push(`Row ${i + 1}: missing name`); continue; }
    if (!["male", "female"].includes((sex ?? "").toLowerCase())) { errors.push(`Row ${i + 1}: sex must be male/female`); continue; }
    if (!classId) { errors.push(`Row ${i + 1}: unknown class "${className}"`); continue; }
    const fd = new FormData();
    fd.set("firstName", firstName); fd.set("lastName", lastName);
    fd.set("sex", sex.toLowerCase()); fd.set("classId", classId);
    if (guardianName) fd.set("guardianName", guardianName);
    if (guardianPhone) fd.set("guardianPhone", guardianPhone);
    const r = await createStudent(slug, null, fd);
    if (r && "error" in r) errors.push(`Row ${i + 1}: ${r.error}`); else ok++;
  }
  revalidatePath(`/students`);
  return { ok: true, imported: ok, errors };
}

/** Year-end promotion: move every active student up one level (doc 10 flow D). */
export async function promoteAll(slug: string, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  const newYearName = String(f.get("yearName"));
  const lv = await db.select().from(levels).where(eq(levels.schoolId, school.id))
    .orderBy(levels.sortOrder);
  const cls = await db.select().from(classes).where(eq(classes.schoolId, school.id));
  const nextLevel = new Map<string, string>();
  for (let i = 0; i < lv.length - 1; i++) nextLevel.set(lv[i].id, lv[i + 1].id);
  const yearId = uid();
  await db.update(academicYears).set({ isCurrent: false }).where(eq(academicYears.schoolId, school.id));
  const y = new Date().getFullYear();
  await db.insert(academicYears).values({
    id: yearId, schoolId: school.id, name: newYearName || `${y}/${y + 1}`,
    startsAt: `${y}-09-01`, endsAt: `${y + 1}-07-31`, isCurrent: true,
  });
  const firstClassOf = (levelId: string) => cls.find((c) => c.levelId === levelId)?.id;
  const all = await db.select().from(students)
    .where(and(eq(students.schoolId, school.id), eq(students.status, "active")));
  for (const s of all) {
    const cur = cls.find((c) => c.id === s.classId);
    const nl = cur ? nextLevel.get(cur.levelId) : undefined;
    if (!nl) { // top level → graduate
      await db.update(students).set({ status: "alumni" }).where(eq(students.id, s.id));
      continue;
    }
    const target = firstClassOf(nl);
    if (!target) continue;
    await db.update(students).set({ classId: target }).where(eq(students.id, s.id));
    await db.insert(enrollments).values({
      id: uid(), schoolId: school.id, studentId: s.id, yearId, classId: target, status: "promoted",
    }).onConflictDoNothing();
  }
  revalidatePath(`/`);
}
