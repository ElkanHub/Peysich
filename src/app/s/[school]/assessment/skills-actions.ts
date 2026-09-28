"use server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { skillRatings, students } from "@/db/schema";
import { requireModule, getCurrentTerm, getTeacherScope } from "@/core/school-context";

export type SaveResult = { ok: true } | { ok: false; error: string };

/** Save one or more cells ("student:domain" → label). An empty or unknown
 *  label clears the cell. Returns an error sentence instead of failing silently. */
export async function saveSkillRatings(
  slug: string, classId: string, cells: Record<string, string>,
): Promise<SaveResult> {
  const { school, user } = await requireModule(slug, "assessment", ["admin", "teacher"]);
  if (user.role === "teacher") {
    const scope = await getTeacherScope(school.id, user.id);
    if (!scope?.homeroomIds.has(classId)) return { ok: false, error: "This is not your class." };
  }
  const term = await getCurrentTerm(school.id);
  if (!term) return { ok: false, error: "There is no current term." };
  if (term.scoresLocked) return { ok: false, error: "This term is closed — ratings can no longer change." };
  // labels come from the school's configurable scale
  const { getStructure } = await import("@/core/academics");
  const S = await getStructure(school.id);
  const VALID = new Set(S.skillScaleFor("preschool"));
  const roster = new Set((await db.select({ id: students.id }).from(students)
    .where(and(eq(students.schoolId, school.id), eq(students.classId, classId))))
    .map((r) => r.id));
  for (const [k, rating] of Object.entries(cells)) {
    const [studentId, domainId] = k.split(":");
    if (!roster.has(studentId)) continue;
    if (!VALID.has(rating)) {
      await db.delete(skillRatings).where(and(
        eq(skillRatings.studentId, studentId), eq(skillRatings.termId, term.id),
        eq(skillRatings.domainId, domainId)));
      continue;
    }
    await db.insert(skillRatings)
      .values({ schoolId: school.id, studentId, termId: term.id, domainId, rating, ratedBy: user.id })
      .onConflictDoUpdate({
        target: [skillRatings.studentId, skillRatings.termId, skillRatings.domainId],
        set: { rating, ratedBy: user.id, updatedAt: new Date() },
      });
  }
  return { ok: true }; // the grid already shows the value; no page refresh per tap
}
