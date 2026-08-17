"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { assessments, scores, terms } from "@/db/schema";
import { publishTermReports } from "@/modules/assessment/publish";
import { requireModule, getCurrentTerm } from "@/core/school-context";
import { uid } from "@/lib/utils";

export async function createAssessment(slug: string, classId: string, subjectId: string, f: FormData) {
  const { school, user } = await requireModule(slug, "assessment", ["admin", "teacher"]);
  const term = await getCurrentTerm(school.id);
  if (!term || term.scoresLocked) throw new Error("Term closed");
  await db.insert(assessments).values({
    id: uid(), schoolId: school.id, termId: term.id, classId, subjectId,
    kind: String(f.get("kind") || "ca"), title: String(f.get("title")),
    maxScore: Number(f.get("maxScore")) || 100, createdBy: user.id,
  });
  revalidatePath(`/assessment/${classId}/${subjectId}`);
}

/** Bulk score save: inputs named sc_<studentId>; blank = skip; validates range. */
export async function saveScores(slug: string, assessmentId: string, f: FormData) {
  const { school, user } = await requireModule(slug, "assessment", ["admin", "teacher"]);
  const [a] = await db.select().from(assessments)
    .where(and(eq(assessments.id, assessmentId), eq(assessments.schoolId, school.id)));
  if (!a) throw new Error("Not found");
  const [t] = await db.select().from(terms).where(eq(terms.id, a.termId));
  if (t?.scoresLocked) throw new Error("Term closed");
  for (const [k, v] of f.entries()) {
    if (!k.startsWith("sc_") || v === "") continue;
    const score = Math.max(0, Math.min(a.maxScore, Number(v) || 0));
    await db.insert(scores)
      .values({ assessmentId, studentId: k.slice(3), schoolId: school.id, score, enteredBy: user.id })
      .onConflictDoUpdate({
        target: [scores.assessmentId, scores.studentId],
        set: { score, enteredBy: user.id, updatedAt: new Date() },
      });
  }
  revalidatePath(`/assessment/${a.classId}/${a.subjectId}`);
}

/** Publish all report cards for the current term (admin, doc 10 flow C). */
export async function publishReports(slug: string) {
  const { school } = await requireModule(slug, "assessment", ["admin"]);
  const term = await getCurrentTerm(school.id);
  if (!term) throw new Error("No current term");
  await publishTermReports(school.id, term.id);
  revalidatePath(`/assessment/matrix`);
}
