import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { getSchoolBySlug } from "./tenant";
import { getSession } from "./session";
import { getEnabledModules } from "./entitlements";
import { db } from "@/db";
import { terms, academicYears } from "@/db/schema";

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
