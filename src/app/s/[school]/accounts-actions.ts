"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { staff, guardians, students, classes, user as userTable } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { auth } from "@/core/auth";
import { createSchoolLogin, tempPassword } from "@/core/accounts";

export type IssueResult = { loginAs: string; password: string } | { error: string };

/** Issue a login for a staff member / guardian / student (admin-only, doc 10). */
export async function issueLogin(
  slug: string, kind: "staff" | "guardian" | "student", id: string,
): Promise<IssueResult> {
  const { school } = await requireSchool(slug, ["admin"]);
  if (kind === "staff") {
    const [s] = await db.select().from(staff)
      .where(and(eq(staff.id, id), eq(staff.schoolId, school.id)));
    if (!s) return { error: "Not found" };
    if (s.userId) return { error: "Already has a login" };
    const r = await createSchoolLogin({
      schoolId: school.id, schoolSlug: school.slug, name: s.name,
      role: s.staffRole === "teacher" ? "teacher" : "admin",
      email: s.email, phone: s.phone,
      username: s.email ? s.email.split("@")[0] : `staff.${s.name.split(" ")[0]}.${id.slice(0, 4)}`,
    });
    if ("error" in r) return r;
    await db.update(staff).set({ userId: r.userId }).where(eq(staff.id, id));
    revalidatePath("/staff");
    return { loginAs: r.loginAs, password: r.password };
  }
  if (kind === "guardian") {
    const [g] = await db.select().from(guardians)
      .where(and(eq(guardians.id, id), eq(guardians.schoolId, school.id)));
    if (!g) return { error: "Not found" };
    if (g.userId) return { error: "Already has a login" };
    const r = await createSchoolLogin({
      schoolId: school.id, schoolSlug: school.slug, name: g.name, role: "parent",
      email: g.email, phone: g.phone, username: `p${g.phone.replace(/\D/g, "")}`,
    });
    if ("error" in r) return r;
    await db.update(guardians).set({ userId: r.userId }).where(eq(guardians.id, id));
    revalidatePath("/guardians");
    return { loginAs: r.loginAs, password: r.password };
  }
  const [st] = await db.select().from(students)
    .where(and(eq(students.id, id), eq(students.schoolId, school.id)));
  if (!st) return { error: "Not found" };
  if (st.userId) return { error: "Already has a login" };
  const r = await createSchoolLogin({
    schoolId: school.id, schoolSlug: school.slug,
    name: `${st.firstName} ${st.lastName}`, role: "student",
    username: st.admissionNo.toLowerCase(),
  });
  if ("error" in r) return r;
  await db.update(students).set({ userId: r.userId }).where(eq(students.id, id));
  revalidatePath(`/students/${id}`);
  return { loginAs: r.loginAs, password: r.password };
}

/** Reset a school person's password — for when a family loses the login and
 *  comes to the office. New temp password is shown ONCE to the admin. */
export async function resetLogin(
  slug: string, kind: "staff" | "guardian" | "student", id: string,
): Promise<IssueResult> {
  const { school } = await requireSchool(slug, ["admin"]);
  const table = kind === "staff" ? staff : kind === "guardian" ? guardians : students;
  const [rec] = await db.select({ userId: table.userId }).from(table)
    .where(and(eq(table.id, id), eq(table.schoolId, school.id)));
  if (!rec?.userId) return { error: "No login exists yet" };
  const [u] = await db.select().from(userTable).where(and(
    eq(userTable.id, rec.userId), eq(userTable.schoolId, school.id)));
  if (!u) return { error: "Login not found" };
  const password = tempPassword();
  const ctx = await auth.$context;
  await ctx.internalAdapter.updatePassword(u.id, await ctx.password.hash(password));
  return { loginAs: u.username ?? u.email, password };
}

export async function setClassTeacher(slug: string, classId: string, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  await db.update(classes)
    .set({ classTeacherId: String(f.get("staffId") || "") || null })
    .where(and(eq(classes.id, classId), eq(classes.schoolId, school.id)));
  revalidatePath("/settings");
}
