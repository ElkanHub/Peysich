import { cache } from "react";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { getSchoolBySlug } from "./tenant";
import { getSession } from "./session";
import { getEnabledModules } from "./entitlements";
import { getAdminGrants, type AdminGrants } from "./access";
import { db } from "@/db";
import { terms, academicYears, staff, classes, teachingAssignments } from "@/db/schema";

export type Ctx = {
  school: NonNullable<Awaited<ReturnType<typeof getSchoolBySlug>>>;
  user: { id: string; name: string; role: string; schoolId?: string | null };
  modules: Set<string>;
  /** Team & access — null means FULL admin (or a non-admin role). */
  grants: AdminGrants | null;
};

/** Tabs that never need a grant: the dashboard, own account, block page. */
const OPEN_TABS = new Set(["", "account", "no-access", "go"]);

/** Which tab this request is for — first segment after any /s/{slug}. */
async function requestTab(slug: string) {
  const h = await headers();
  let p = h.get("x-peysich-path") ?? "";
  if (p.startsWith(`/s/${slug}`)) p = p.slice(`/s/${slug}`.length);
  return p.split("/").filter(Boolean)[0] ?? "";
}

/** The one gate every school page & action goes through. Limited admin
 *  members (Team & access) get checked against the tab they're opening —
 *  everything they weren't granted redirects to the friendly block page. */
export const requireSchool = cache(async (slug: string, roles?: string[]): Promise<Ctx> => {
  const school = await getSchoolBySlug(slug);
  if (!school || school.status === "archived") notFound();
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const user = session.user as Ctx["user"];
  if (user.schoolId !== school.id && user.role !== "platform_admin") redirect("/sign-in");
  if (roles && !roles.includes(user.role) && user.role !== "platform_admin") redirect(".");
  let grants: AdminGrants | null = null;
  if (user.role === "admin") {
    grants = await getAdminGrants(school.id, user.id);
    if (grants) {
      const tab = await requestTab(slug);
      if (!OPEN_TABS.has(tab) && !grants.tabs.has(tab))
        redirect(`/no-access?t=${encodeURIComponent(tab)}`);
    }
  }
  return { school, user, modules: await getEnabledModules(school.id), grants };
});

/** Same gate + module check, for module pages/actions. */
export async function requireModule(slug: string, moduleKey: string, roles?: string[]) {
  const ctx = await requireSchool(slug, roles);
  if (!ctx.modules.has(moduleKey)) redirect(".");
  return ctx;
}

/** Current term (and year) for a school — most flows hang off this.
 *  The conventional rule: the ACTIVE term is the one whose start/end dates
 *  contain today. During vacation (between terms) the admin's chosen term
 *  keeps working; with no choice we fall to the next upcoming, then the
 *  most recently ended — so the app always has a sensible term to stand on. */
export const getCurrentTerm = cache(async (schoolId: string) => {
  const ts = await db.select().from(terms).where(eq(terms.schoolId, schoolId));
  if (!ts.length) return null;
  const today = new Date().toISOString().slice(0, 10);
  const flagged = ts.find((t) => t.isCurrent);
  const containing = ts.filter((t) => t.startsAt <= today && today <= t.endsAt);
  const byStart = [...ts].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const t =
    (flagged && containing.some((c) => c.id === flagged.id) ? flagged : containing[0])
    ?? flagged
    ?? byStart.find((x) => x.startsAt > today)
    ?? byStart.at(-1)!;
  const [y] = await db.select().from(academicYears).where(eq(academicYears.id, t.yearId));
  return { ...t, year: y };
});


/** THE teacher capability model — two distinct rights, never blended:
 *  · homeroomIds — classes in their pastoral care (form master, main class
 *    teacher, or class assistant): register, skills sheets, remarks.
 *  · cells — class+subject pairs derived from teacher PROFILES (subject +
 *    levels, main or assistant): score sheets and homework for exactly those.
 *  Timetable lessons grant NO rights — they only display the schedule. */
export async function getTeacherScope(schoolId: string, userId: string) {
  const [me] = await db.select().from(staff)
    .where(and(eq(staff.schoolId, schoolId), eq(staff.userId, userId)));
  if (!me) return null; // unlinked account → caller shows the hint
  // profile-derived: form master OR main class teacher OR class assistant
  // owns the homeroom; subject cells come from pool membership — mains AND
  // assistants both work the class, one of them just signs as main.
  const { getStructure } = await import("./academics");
  const S = await getStructure(schoolId);
  const homeroomIds = new Set<string>();
  const cells: { classId: string; subjectId: string }[] = [];
  for (const c of S.classes) {
    if (c.classTeacherId === me.id || S.formMasterOf(c.id) === me.id
      || (S.classAssistants.get(c.id) ?? []).some((a) => a.staffId === me.id)) {
      homeroomIds.add(c.id);
    }
    if (S.modeBySection.get(S.sectionOfClass(c)) !== "class_teacher") {
      for (const sid of S.effectiveSubjectIds(c.id)) {
        if (S.poolFor(c.id, sid).some((p) => p.staffId === me.id))
          cells.push({ classId: c.id, subjectId: sid });
      }
    }
  }
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
