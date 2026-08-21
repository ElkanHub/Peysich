"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { componentScores, scoreSheets, scorePublications, students } from "@/db/schema";
import { publishTermReports } from "@/modules/assessment/publish";
import { requireModule, getCurrentTerm, getTeacherScope } from "@/core/school-context";
import { getStructure } from "@/core/academics";
import { uid } from "@/lib/utils";

/** Shared guts of save/submit: writes outOf + raw marks for every component
 *  the caller may edit. Teachers may not touch submitted columns; admins may. */
async function writeSheet(slug: string, classId: string, subjectId: string, f: FormData) {
  const { school, user } = await requireModule(slug, "assessment", ["admin", "teacher"]);
  const isTeacher = user.role === "teacher";
  if (isTeacher) {
    const scope = await getTeacherScope(school.id, user.id);
    if (!scope?.canScore(classId, subjectId)) throw new Error("Not your sheet");
  }
  const term = await getCurrentTerm(school.id);
  const back = `/assessment/${classId}/${subjectId}`;
  if (!term || term.scoresLocked) redirect(`${back}?err=closed`);

  const S = await getStructure(school.id);
  const cls = S.classById.get(classId);
  if (!cls) redirect(back);
  const comps = S.componentsFor(S.sectionOfClass(cls));
  const sheets = await db.select().from(scoreSheets).where(and(
    eq(scoreSheets.termId, term.id), eq(scoreSheets.classId, classId),
    eq(scoreSheets.subjectId, subjectId)));
  const sheetBy = new Map(sheets.map((s) => [s.componentId, s]));
  const roster = await db.select({ id: students.id }).from(students).where(and(
    eq(students.schoolId, school.id), eq(students.classId, classId),
    eq(students.status, "active")));

  for (const comp of comps) {
    const sheet = sheetBy.get(comp.id);
    const editable = !isTeacher || !sheet?.submitted;
    if (!editable) continue;

    const outOfRaw = Math.round(Number(f.get(`outOf_${comp.id}`)) || 0);
    const outOf = outOfRaw >= 1 ? outOfRaw : (sheet?.outOf ?? 100);
    if (!sheet) {
      await db.insert(scoreSheets).values({
        id: uid(), schoolId: school.id, termId: term.id, classId, subjectId,
        componentId: comp.id, outOf,
      }).onConflictDoNothing();
    } else if (sheet.outOf !== outOf) {
      await db.update(scoreSheets).set({ outOf }).where(eq(scoreSheets.id, sheet.id));
    }

    for (const r of roster) {
      const v = f.get(`sc_${comp.id}_${r.id}`);
      if (v === null || String(v).trim() === "") continue;
      const raw = Math.max(0, Math.min(outOf, Number(v) || 0));
      await db.insert(componentScores).values({
        id: uid(), schoolId: school.id, termId: term.id, classId, subjectId,
        componentId: comp.id, studentId: r.id, raw, enteredBy: user.id,
      }).onConflictDoUpdate({
        target: [componentScores.studentId, componentScores.termId,
          componentScores.subjectId, componentScores.componentId],
        set: { raw, enteredBy: user.id, updatedAt: new Date() },
      });
    }
  }
  return { term, user, back };
}

/** Save everything editable on the sheet (draft — nothing locks). */
export async function saveSheet(slug: string, classId: string, subjectId: string, f: FormData) {
  const { back } = await writeSheet(slug, classId, subjectId, f);
  revalidatePath(back);
  redirect(`${back}?flash=saved`);
}

/** Save AND submit one column: from here the teacher sees it read-only;
 *  only an admin can still adjust it (behind the ⋯ disclosure). */
export async function submitSheetColumn(
  slug: string, classId: string, subjectId: string, componentId: string, f: FormData,
) {
  const { term, user, back } = await writeSheet(slug, classId, subjectId, f);
  const [sheet] = await db.select().from(scoreSheets).where(and(
    eq(scoreSheets.termId, term.id), eq(scoreSheets.classId, classId),
    eq(scoreSheets.subjectId, subjectId), eq(scoreSheets.componentId, componentId)));
  if (sheet && !sheet.submitted) {
    await db.update(scoreSheets)
      .set({ submitted: true, submittedBy: user.name, submittedAt: new Date() })
      .where(eq(scoreSheets.id, sheet.id));
  }
  revalidatePath(back);
  redirect(`${back}?flash=done`);
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
  redirect("/assessment?flash=done");
}

/** Publish all report cards for the current term (admin, doc 10 flow C). */
export async function publishReports(slug: string) {
  const { school } = await requireModule(slug, "assessment", ["admin"]);
  const term = await getCurrentTerm(school.id);
  if (!term) throw new Error("No current term");
  await publishTermReports(school.id, term.id);
  revalidatePath(`/assessment/matrix`);
}
