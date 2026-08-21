"use server";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { skillRatings, students } from "@/db/schema";
import { requireModule, getCurrentTerm } from "@/core/school-context";

export async function saveSkillRatings(
  slug: string, classId: string, cells: Record<string, string>,
) {
  const { school, user } = await requireModule(slug, "assessment", ["admin", "teacher"]);
  const term = await getCurrentTerm(school.id);
  if (!term || term.scoresLocked) return;
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
  revalidatePath(`/assessment/skills/${classId}`);
}
