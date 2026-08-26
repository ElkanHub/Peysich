"use server";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { staff, classes, subjects, teachingAssignments, staffTeaching } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { createSchoolLogin } from "@/core/accounts";
import { uid } from "@/lib/utils";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;
const wiz = (id: string, step: number) => `/staff/new?draft=${id}&step=${step}`;
const TYPES = ["teaching", "admin", "support"];
const EMPLOYMENT = ["full_time", "part_time", "contract"];
const ROLES = ["teacher", "admin", "bursar", "none"];

async function ownStaff(slug: string, id: string) {
  const { school } = await requireSchool(slug, ["admin"]);
  const [s] = await db.select().from(staff)
    .where(and(eq(staff.id, id), eq(staff.schoolId, school.id)));
  if (!s) redirect("/staff");
  return { school, s };
}

const bump = (s: { onboardingStep: number | null }, step: number) =>
  ({ onboardingStep: Math.max(s.onboardingStep ?? 0, step) });

/** Stage 1 — personal & contact. Creates the DRAFT staff record. */
export async function startOnboarding(slug: string, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  const name = str(f, "name");
  if (!name) redirect(`/staff/new?err=name`);
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(staff)
    .where(eq(staff.schoolId, school.id));
  const id = uid();
  await db.insert(staff).values({
    id, schoolId: school.id, name,
    staffNo: `STF${String(Number(n) + 1).padStart(4, "0")}`,
    phone: str(f, "phone"), email: str(f, "email"),
    dob: str(f, "dob"), nationality: str(f, "nationality"),
    idNumber: str(f, "idNumber"), address: str(f, "address"),
    emergencyName: str(f, "emergencyName"), emergencyPhone: str(f, "emergencyPhone"),
    status: "draft", onboardingStep: 1,
  });
  redirect(wiz(id, 2));
}

/** Stage 1 revisited. */
export async function savePersonal(slug: string, id: string, f: FormData) {
  const { school, s } = await ownStaff(slug, id);
  await db.update(staff).set({
    name: str(f, "name") ?? s.name, phone: str(f, "phone"), email: str(f, "email"),
    dob: str(f, "dob"), nationality: str(f, "nationality"),
    idNumber: str(f, "idNumber"), address: str(f, "address"),
    emergencyName: str(f, "emergencyName"), emergencyPhone: str(f, "emergencyPhone"),
    ...bump(s, 1),
  }).where(eq(staff.id, id));
  redirect(wiz(id, 2));
}

/** Stage 2 — employment & contract. Teaching reveals stage 3. */
export async function saveEmployment(slug: string, id: string, f: FormData) {
  const { s } = await ownStaff(slug, id);
  const staffType = String(f.get("staffType") ?? "");
  const employmentType = String(f.get("employmentType") ?? "");
  await db.update(staff).set({
    staffNo: str(f, "staffNo") ?? s.staffNo,
    designation: str(f, "designation"),
    staffType: TYPES.includes(staffType) ? staffType : s.staffType,
    employmentType: EMPLOYMENT.includes(employmentType) ? employmentType : s.employmentType,
    joinedOn: str(f, "joinedOn"), probationEnd: str(f, "probationEnd"),
    ...bump(s, 2),
  }).where(eq(staff.id, id));
  const next = TYPES.includes(staffType) && staffType !== "teaching" ? 4 : 3;
  redirect(wiz(id, next));
}

/** Stage 3 — qualifications & competencies (teaching staff only). */
export async function saveQualifications(slug: string, id: string, f: FormData) {
  const { s } = await ownStaff(slug, id);
  const competencies: string[] = [];
  for (const [k] of f.entries()) if (k.startsWith("comp_")) competencies.push(k.slice(5));
  await db.update(staff).set({
    qualification: str(f, "qualification"), institution: str(f, "institution"),
    licenseNo: str(f, "licenseNo"), competencies,
    ...bump(s, 3),
  }).where(eq(staff.id, id));
  redirect(wiz(id, 4));
}

/** Stage 4 — payroll & statutory (admin-only data). */
export async function savePayroll(slug: string, id: string, f: FormData) {
  const { s } = await ownStaff(slug, id);
  const salary = Number(f.get("salaryGhs"));
  await db.update(staff).set({
    bankName: str(f, "bankName"), bankBranch: str(f, "bankBranch"),
    accountNo: str(f, "accountNo"), ssnitNo: str(f, "ssnitNo"), tinNo: str(f, "tinNo"),
    salaryPesewas: salary > 0 ? Math.round(salary * 100) : null,
    ...bump(s, 4),
  }).where(eq(staff.id, id));
  redirect(wiz(id, 5));
}

/** Stage 5 — portal role (or no portal access at all). */
export async function saveAccess(slug: string, id: string, f: FormData) {
  const { s } = await ownStaff(slug, id);
  const role = String(f.get("portalRole") ?? "");
  await db.update(staff).set({
    staffRole: ROLES.includes(role) && role !== "none" ? role : s.staffRole,
    ...bump(s, 5),
    // "none" is remembered by simply not issuing a login at completion
  }).where(eq(staff.id, id));
  redirect(wiz(id, 6) + (role === "none" ? "&portal=none" : ""));
}

/** Stage 6 — review & provisioning: activate + optional login. */
export async function completeOnboarding(slug: string, id: string, f: FormData) {
  const { school, s } = await ownStaff(slug, id);
  await db.update(staff).set({ status: "active", onboardingStep: null })
    .where(eq(staff.id, id));
  if (f.get("issueLogin") === "on" && !s.userId) {
    const r = await createSchoolLogin({
      schoolId: school.id, schoolSlug: school.slug, name: s.name,
      role: s.staffRole === "teacher" ? "teacher" : "admin",
      email: s.email, phone: s.phone,
      username: s.email ? s.email.split("@")[0] : `staff.${(s.staffNo ?? id.slice(0, 6)).toLowerCase()}`,
    });
    if (!("error" in r))
      await db.update(staff).set({ userId: r.userId }).where(eq(staff.id, id));
  }
  revalidatePath("/staff");
  redirect(`/staff/${id}`);
}

export async function discardOnboarding(slug: string, id: string) {
  const { school } = await requireSchool(slug, ["admin"]);
  await db.delete(staff).where(and(
    eq(staff.id, id), eq(staff.schoolId, school.id), eq(staff.status, "draft")));
  revalidatePath("/staff");
  redirect("/staff");
}

/** Staff File edits — one action per card, flash on save. */
export async function updateStaffCard(slug: string, id: string, card: string, f: FormData) {
  const { s } = await ownStaff(slug, id);
  if (card === "personal") await db.update(staff).set({
    name: str(f, "name") ?? s.name, phone: str(f, "phone"), email: str(f, "email"),
    dob: str(f, "dob"), nationality: str(f, "nationality"), idNumber: str(f, "idNumber"),
    address: str(f, "address"),
    emergencyName: str(f, "emergencyName"), emergencyPhone: str(f, "emergencyPhone"),
  }).where(eq(staff.id, id));
  if (card === "employment") {
    const staffType = String(f.get("staffType") ?? ""), employmentType = String(f.get("employmentType") ?? "");
    await db.update(staff).set({
      staffNo: str(f, "staffNo") ?? s.staffNo, designation: str(f, "designation"),
      staffType: TYPES.includes(staffType) ? staffType : s.staffType,
      employmentType: EMPLOYMENT.includes(employmentType) ? employmentType : s.employmentType,
      joinedOn: str(f, "joinedOn"), probationEnd: str(f, "probationEnd"),
    }).where(eq(staff.id, id));
  }
  if (card === "qualifications") {
    const competencies: string[] = [];
    for (const [k] of f.entries()) if (k.startsWith("comp_")) competencies.push(k.slice(5));
    await db.update(staff).set({
      qualification: str(f, "qualification"), institution: str(f, "institution"),
      licenseNo: str(f, "licenseNo"), competencies,
    }).where(eq(staff.id, id));
  }
  if (card === "payroll") {
    const salary = Number(f.get("salaryGhs"));
    await db.update(staff).set({
      bankName: str(f, "bankName"), bankBranch: str(f, "bankBranch"),
      accountNo: str(f, "accountNo"), ssnitNo: str(f, "ssnitNo"), tinNo: str(f, "tinNo"),
      salaryPesewas: salary > 0 ? Math.round(salary * 100) : null,
    }).where(eq(staff.id, id));
  }
  revalidatePath(`/staff/${id}`);
  redirect(`/staff/${id}?flash=saved`);
}

export async function setStaffPhoto(slug: string, id: string, fileKey: string) {
  const { school } = await requireSchool(slug, ["admin"]);
  if (!fileKey.startsWith(`school/${school.id}/`)) return { error: "Invalid file" };
  await db.update(staff).set({ photoUrl: fileKey })
    .where(and(eq(staff.id, id), eq(staff.schoolId, school.id)));
  revalidatePath(`/staff/${id}`);
  return { ok: true };
}

/** Offboarding-lite: status transition, never a delete. Releases the class-
 *  teacher role and every subject allocation so the gaps show for refilling. */
export async function markStaffLeft(slug: string, id: string, f: FormData) {
  const { school, s } = await ownStaff(slug, id);
  if (s.status !== "active") redirect(`/staff/${id}`);
  await db.update(staff).set({
    status: "left",
    exitDate: str(f, "exitDate") ?? new Date().toISOString().slice(0, 10),
    exitNote: str(f, "exitNote"),
  }).where(eq(staff.id, id));
  await db.update(classes).set({ classTeacherId: null })
    .where(and(eq(classes.schoolId, school.id), eq(classes.classTeacherId, id)));
  await db.update(classes).set({ formMasterId: null })
    .where(and(eq(classes.schoolId, school.id), eq(classes.formMasterId, id)));
  await db.delete(teachingAssignments).where(and(
    eq(teachingAssignments.schoolId, school.id), eq(teachingAssignments.teacherId, id)));
  await db.delete(staffTeaching).where(and(
    eq(staffTeaching.schoolId, school.id), eq(staffTeaching.staffId, id)));
  revalidatePath("/staff");
  redirect(`/staff/${id}?flash=done`);
}

export async function reinstateStaff(slug: string, id: string) {
  const { s } = await ownStaff(slug, id);
  if (s.status !== "left") return;
  await db.update(staff).set({ status: "active", exitDate: null, exitNote: null })
    .where(eq(staff.id, id));
  revalidatePath("/staff");
  revalidatePath(`/staff/${id}`);
}

/* ── Allocations ─────────────────────────────────────────────────────── */

/** Assign (or clear) the teacher for one class-subject cell. */
export async function setAllocation(slug: string, classId: string, subjectId: string, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  const teacherId = String(f.get("teacherId") ?? "");
  const [c] = await db.select({ id: classes.id }).from(classes)
    .where(and(eq(classes.id, classId), eq(classes.schoolId, school.id)));
  if (!c) return;
  if (!teacherId) {
    await db.delete(teachingAssignments).where(and(
      eq(teachingAssignments.classId, classId), eq(teachingAssignments.subjectId, subjectId)));
  } else {
    await db.insert(teachingAssignments)
      .values({ id: uid(), schoolId: school.id, teacherId, classId, subjectId })
      .onConflictDoUpdate({
        target: [teachingAssignments.classId, teachingAssignments.subjectId],
        set: { teacherId },
      });
  }
  revalidatePath("/staff/allocations");
}

/** The primary-school shortcut: class teacher takes every subject. */
export async function fillClassWithTeacher(slug: string, classId: string) {
  const { school } = await requireSchool(slug, ["admin"]);
  const [c] = await db.select().from(classes)
    .where(and(eq(classes.id, classId), eq(classes.schoolId, school.id)));
  if (!c?.classTeacherId) redirect(`/staff/allocations?err=noteacher`);
  const subs = await db.select().from(subjects).where(eq(subjects.schoolId, school.id));
  for (const sub of subs) {
    await db.insert(teachingAssignments)
      .values({ id: uid(), schoolId: school.id, teacherId: c.classTeacherId!, classId, subjectId: sub.id })
      .onConflictDoUpdate({
        target: [teachingAssignments.classId, teachingAssignments.subjectId],
        set: { teacherId: c.classTeacherId! },
      });
  }
  revalidatePath("/staff/allocations");
  redirect(`/staff/allocations?flash=done#class-${classId}`);
}

/* ── Teacher PROFILES — who a teacher IS, set once, everything derived ── */

/** Add a role to a teacher's profile: main class teacher (one per class),
 *  class assistant (any number), or subject teacher (subject + levels,
 *  main/assistant). */
export async function addTeachingRole(slug: string, staffId: string, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  const [me] = await db.select({ id: staff.id }).from(staff)
    .where(and(eq(staff.id, staffId), eq(staff.schoolId, school.id)));
  if (!me) redirect(`/staff/allocations`);
  const what = String(f.get("what") || "");
  const classId = String(f.get("classId") || "");
  const subjectId = String(f.get("subjectId") || "");
  const levelIds = f.getAll("levelIds").map(String).filter(Boolean);

  if (what === "class-main" && classId) {
    await db.update(classes).set({ classTeacherId: staffId })
      .where(and(eq(classes.id, classId), eq(classes.schoolId, school.id)));
  } else if (what === "class-assist" && classId) {
    const dup = await db.select({ id: staffTeaching.id }).from(staffTeaching).where(and(
      eq(staffTeaching.schoolId, school.id), eq(staffTeaching.staffId, staffId),
      eq(staffTeaching.kind, "class"), eq(staffTeaching.classId, classId)));
    if (!dup.length) await db.insert(staffTeaching).values({
      id: uid(), schoolId: school.id, staffId, kind: "class", classId, role: "assistant",
    });
  } else if (what === "subject" && subjectId && levelIds.length) {
    // one row per teacher × subject — re-adding replaces the levels/role
    await db.delete(staffTeaching).where(and(
      eq(staffTeaching.schoolId, school.id), eq(staffTeaching.staffId, staffId),
      eq(staffTeaching.kind, "subject"), eq(staffTeaching.subjectId, subjectId)));
    await db.insert(staffTeaching).values({
      id: uid(), schoolId: school.id, staffId, kind: "subject", subjectId,
      levelIds: JSON.stringify(levelIds),
      role: String(f.get("role")) === "assistant" ? "assistant" : "main",
    });
  } else {
    redirect(`/staff/allocations?err=roleform`);
  }
  revalidatePath("/staff/allocations");
  redirect(`/staff/allocations?flash=saved`);
}

export async function removeTeachingRole(slug: string, roleId: string) {
  const { school } = await requireSchool(slug, ["admin"]);
  await db.delete(staffTeaching).where(and(
    eq(staffTeaching.id, roleId), eq(staffTeaching.schoolId, school.id)));
  revalidatePath("/staff/allocations");
  redirect(`/staff/allocations?flash=done`);
}

/** Release the MAIN class-teacher seat of a class. */
export async function clearMainClassTeacher(slug: string, classId: string) {
  const { school } = await requireSchool(slug, ["admin"]);
  await db.update(classes).set({ classTeacherId: null })
    .where(and(eq(classes.id, classId), eq(classes.schoolId, school.id)));
  revalidatePath("/staff/allocations");
  redirect(`/staff/allocations?flash=done`);
}

/** The pastoral tag — every class's responsible teacher. Empty means
 *  "auto": the class teacher carries it (class-teaching mode). */
export async function setFormMaster(slug: string, classId: string, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  await db.update(classes)
    .set({ formMasterId: String(f.get("staffId") || "") || null })
    .where(and(eq(classes.id, classId), eq(classes.schoolId, school.id)));
  revalidatePath("/staff/allocations");
  redirect(`/staff/allocations?flash=saved`);
}
