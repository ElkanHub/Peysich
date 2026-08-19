import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { getSchoolBySlug } from "./tenant";
import { getSession } from "./session";
import { getEnabledModules } from "./entitlements";
import { db } from "@/db";
import { terms, academicYears, staff, classes, lessons, teachingAssignments } from "@/db/schema";

export type Ctx = {
  school: NonNullable<Awaited<ReturnType<typeof getSchoolBySlug>>>;
  user: { id: string; name: string; role: string; schoolId?: string | null };
  modules: Set<string>;
};

/** The one gate every school page & action goes through. */
export const requireSchool = cache(async (slug: string, roles?: string[]): Promise<Ctx> => {
  const school = await getSchoolBySlug(slug);
  if (!school || school.status === "archived") notFound();
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const user = session.user as Ctx["user"];
  if (user.schoolId !== school.id && user.role !== "platform_admin") redirect("/sign-in");
  if (roles && !roles.includes(user.role) && user.role !== "platform_admin") redirect(".");
  return { school, user, modules: await getEnabledModules(school.id) };
});

/** Same gate + module check, for module pages/actions. */
export async function requireModule(slug: string, moduleKey: string, roles?: string[]) {
  const ctx = await requireSchool(slug, roles);
  if (!ctx.modules.has(moduleKey)) redirect(".");
  return ctx;
}

/** Current term (and year) for a school — most flows hang off this. */
export const getCurrentTerm = cache(async (schoolId: string) => {
  const [t] = await db.select().from(terms)
    .where(and(eq(terms.schoolId, schoolId), eq(terms.isCurrent, true)));
  if (!t) return null;
  const [y] = await db.select().from(academicYears).where(eq(academicYears.id, t.yearId));
  return { ...t, year: y };
});

/** Classes a teacher owns: class-teacher of, or teaches lessons in. */
export async function getTeacherClassIds(schoolId: string, userId: string): Promise<Set<string> | null> {
  const [me] = await db.select().from(staff)
    .where(and(eq(staff.schoolId, schoolId), eq(staff.userId, userId)));
  if (!me) return null; // unlinked account → caller decides (usually show none + hint)
  const [own, taught, assigned] = await Promise.all([
    db.select({ id: classes.id }).from(classes)
      .where(and(eq(classes.schoolId, schoolId), eq(classes.classTeacherId, me.id))),
    db.select({ id: lessons.classId }).from(lessons)
      .where(and(eq(lessons.schoolId, schoolId), eq(lessons.teacherId, me.id))),
    db.select({ id: teachingAssignments.classId }).from(teachingAssignments)
      .where(and(eq(teachingAssignments.schoolId, schoolId), eq(teachingAssignments.teacherId, me.id))),
  ]);
  return new Set([...own.map((r) => r.id), ...taught.map((r) => r.id), ...assigned.map((r) => r.id)]);
}
