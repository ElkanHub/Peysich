import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { getSchoolBySlug } from "./tenant";
import { getSession } from "./session";
import { getEnabledModules } from "./entitlements";
import { db } from "@/db";
import { terms, academicYears, staff, classes, teachingAssignments } from "@/db/schema";

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


/** THE teacher capability model — two distinct rights, never blended:
 *  · homeroomIds — classes where they are class teacher (form master):
 *    attendance register, skills sheets, remarks.
 *  · cells — class+subject pairs from teaching allocations: score sheets
 *    and homework for exactly those subjects.
 *  Timetable lessons grant NO rights — they only display the schedule. */
export async function getTeacherScope(schoolId: string, userId: string) {
  const [me] = await db.select().from(staff)
    .where(and(eq(staff.schoolId, schoolId), eq(staff.userId, userId)));
  if (!me) return null; // unlinked account → caller shows the hint
  const [own, cells] = await Promise.all([
    db.select({ id: classes.id }).from(classes)
      .where(and(eq(classes.schoolId, schoolId), eq(classes.classTeacherId, me.id))),
    db.select({ classId: teachingAssignments.classId, subjectId: teachingAssignments.subjectId })
      .from(teachingAssignments)
      .where(and(eq(teachingAssignments.schoolId, schoolId), eq(teachingAssignments.teacherId, me.id))),
  ]);
  const homeroomIds = new Set(own.map((r) => r.id));
  const subjectClassIds = new Set(cells.map((c) => c.classId));
  return {
    staffId: me.id, name: me.name,
    homeroomIds, cells, subjectClassIds,
    allClassIds: new Set([...homeroomIds, ...subjectClassIds]),
    /** score-sheet right: form master of the class, or allocated the cell */
    canScore: (classId: string, subjectId: string) =>
      homeroomIds.has(classId) || cells.some((c) => c.classId === classId && c.subjectId === subjectId),
  };
}

/** @deprecated prefer getTeacherScope — this returns the union of both
 *  capabilities for callers that only need "is this one of my classes". */
export async function getTeacherClassIds(schoolId: string, userId: string): Promise<Set<string> | null> {
  const scope = await getTeacherScope(schoolId, userId);
  return scope ? scope.allClassIds : null;
}
