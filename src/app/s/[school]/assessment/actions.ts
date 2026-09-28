"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { componentScores, scoreSheets, scorePublications } from "@/db/schema";
import { publishTermReports } from "@/modules/assessment/publish";
import { requireModule, getCurrentTerm, getTeacherScope } from "@/core/school-context";
import { getStructure } from "@/core/academics";
import { uid } from "@/lib/utils";
import { withFlash } from "@/lib/flash";

export type CellResult = { ok: true } | { ok: false; error: string };

/** Typed in a cell to mean “did not write”. Stored as absent=true, never as 0 marks. */
const DID_NOT_WRITE = new Set(["-", "–", "a", "abs", "absent"]);

/** Rights + term + column checks shared by every write. Returns the column's
 *  sheet row (may be undefined before the test is started) or an error sentence. */
type Guard =
  | { error: string; school?: undefined; user?: undefined; term?: undefined; comp?: undefined; sheet?: undefined }
  | { error?: undefined; school: Awaited<ReturnType<typeof requireModule>>["school"]; user: Awaited<ReturnType<typeof requireModule>>["user"];
      term: NonNullable<Awaited<ReturnType<typeof getCurrentTerm>>>; comp: { id: string; name: string; weight?: number };
      sheet: typeof scoreSheets.$inferSelect | undefined };

async function guard(slug: string, classId: string, subjectId: string, componentId: string): Promise<Guard> {
  const { school, user } = await requireModule(slug, "assessment", ["admin", "teacher"]);
  const isTeacher = user.role === "teacher";
  if (isTeacher) {
    const scope = await getTeacherScope(school.id, user.id);
    if (!scope?.canScore(classId, subjectId)) return { error: "This is not your sheet." };
  }
  const term = await getCurrentTerm(school.id);
  if (!term) return { error: "There is no current term." };
  if (term.scoresLocked) return { error: "This term is closed — scores can no longer change." };
  const S = await getStructure(school.id);
  const cls = S.classById.get(classId);
  const comp = cls && S.componentsFor(S.sectionOfClass(cls)).find((c) => c.id === componentId);
  if (!comp) return { error: "That test no longer exists." };
  const [sheet] = await db.select().from(scoreSheets).where(and(
    eq(scoreSheets.termId, term.id), eq(scoreSheets.classId, classId),
    eq(scoreSheets.subjectId, subjectId), eq(scoreSheets.componentId, componentId)));
  if (isTeacher && sheet?.submitted) return { error: `${comp.name} is locked. The head can unlock it.` };
  return { school, user, term, comp, sheet };
}

/** Start a test column, or change what it was marked out of. */
export async function setOutOf(
  slug: string, classId: string, subjectId: string, componentId: string, outOf: number,
): Promise<CellResult> {
  const g = await guard(slug, classId, subjectId, componentId);
  if (g.error !== undefined) return { ok: false, error: g.error };
  if (!Number.isInteger(outOf) || outOf < 1) return { ok: false, error: "Marked out of must be a whole number of 1 or more." };
  if (!g.sheet) {
    await db.insert(scoreSheets).values({
      id: uid(), schoolId: g.school.id, termId: g.term.id, classId, subjectId, componentId, outOf,
    }).onConflictDoNothing();
  } else if (g.sheet.outOf !== outOf) {
    await db.update(scoreSheets).set({ outOf }).where(eq(scoreSheets.id, g.sheet.id));
  }
  return { ok: true };
}

/** Save ONE pupil's mark for one test — called as the teacher types.
 *  "", clears the mark; "a" / "abs" / "-" = did not write; a number must be
 *  0..outOf or it is refused (never clamped, never stored as 0). */
export async function saveMark(
  slug: string, classId: string, subjectId: string, componentId: string,
  studentId: string, value: string,
): Promise<CellResult> {
  const g = await guard(slug, classId, subjectId, componentId);
  if (g.error !== undefined) return { ok: false, error: g.error };
  if (!g.sheet) return { ok: false, error: "Start this test first — say what it was marked out of." };
  const text = value.trim().toLowerCase();
  const where = and(
    eq(componentScores.studentId, studentId), eq(componentScores.termId, g.term.id),
    eq(componentScores.subjectId, subjectId), eq(componentScores.componentId, componentId));
  if (text === "") {
    await db.delete(componentScores).where(where);
    return { ok: true };
  }
  const absent = DID_NOT_WRITE.has(text);
  const n = absent ? 0 : Number(text);
  if (!absent && !Number.isFinite(n)) return { ok: false, error: "Not a number" };
  if (n < 0) return { ok: false, error: "Below 0" };
  if (n > g.sheet.outOf) return { ok: false, error: `Above ${g.sheet.outOf}` };
  await db.insert(componentScores).values({
    id: uid(), schoolId: g.school.id, termId: g.term.id, classId, subjectId,
    componentId, studentId, raw: n, absent, enteredBy: g.user.id,
  }).onConflictDoUpdate({
    target: [componentScores.studentId, componentScores.termId,
      componentScores.subjectId, componentScores.componentId],
    set: { raw: n, absent, enteredBy: g.user.id, updatedAt: new Date() },
  });
  return { ok: true };
}

/** Lock one test column: from here the teacher sees it read-only;
 *  only an admin can still adjust it (behind “Unlock a locked test”). */
export async function lockColumn(
  slug: string, classId: string, subjectId: string, componentId: string,
) {
  const back = `/assessment/${classId}/${subjectId}`;
  const g = await guard(slug, classId, subjectId, componentId);
  if (g.error !== undefined) redirect(withFlash(back, g.error, { error: true }));
  if (!g.sheet) redirect(withFlash(back, "Start the test first.", { error: true }));
  if (!g.sheet.submitted) {
    await db.update(scoreSheets)
      .set({ submitted: true, submittedBy: g.user.name, submittedAt: new Date() })
      .where(eq(scoreSheets.id, g.sheet.id));
  }
  revalidatePath(back);
  redirect(withFlash(back, `${g.comp.name} locked.`));
}

/** Admin: make one component's marks visible to students & parents. */
export async function publishComponent(slug: string, componentId: string) {
  const { school, user } = await requireModule(slug, "assessment", ["admin"]);
  const term = await getCurrentTerm(school.id);
  if (!term) redirect("/assessment");
  await db.insert(scorePublications).values({
    id: uid(), schoolId: school.id, termId: term.id, componentId, publishedBy: user.name,
  }).onConflictDoNothing();
  revalidatePath("/assessment");
  redirect(withFlash("/assessment", "Marks released to families."));
}

/** Publish all report cards for the current term (admin, doc 10 flow C). */
export async function publishReports(slug: string) {
  const { school } = await requireModule(slug, "assessment", ["admin"]);
  const term = await getCurrentTerm(school.id);
  if (!term) throw new Error("No current term");
  await publishTermReports(school.id, term.id);
  revalidatePath(`/assessment/matrix`);
}
