import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  assessments, scores, gradingSchemes, reportCards, students, subjects,
  attendanceRecords, terms,
} from "@/db/schema";
import { uid } from "@/lib/utils";

type Scheme = { caWeight: number; examWeight: number; bands: { min: number; grade: string; remark: string }[] };

async function computeStudent(schoolId: string, studentId: string, termId: string, scheme: Scheme) {
  const rows = await db.select({
    subjectId: assessments.subjectId, kind: assessments.kind,
    maxScore: assessments.maxScore, score: scores.score, subjectName: subjects.name,
  }).from(scores)
    .innerJoin(assessments, eq(scores.assessmentId, assessments.id))
    .innerJoin(subjects, eq(assessments.subjectId, subjects.id))
    .where(and(eq(scores.schoolId, schoolId), eq(scores.studentId, studentId),
      eq(assessments.termId, termId)));
  const bySubject = new Map<string, { name: string; ca: number[]; exam: number[] }>();
  for (const r of rows) {
    const s = bySubject.get(r.subjectId) ?? { name: r.subjectName, ca: [], exam: [] };
    (r.kind === "exam" ? s.exam : s.ca).push((r.score / r.maxScore) * 100);
    bySubject.set(r.subjectId, s);
  }
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  return [...bySubject.values()].map((s) => {
    const ca = Math.round(avg(s.ca) * (scheme.caWeight / 100));
    const exam = Math.round(avg(s.exam) * (scheme.examWeight / 100));
    const total = ca + exam;
    const band = scheme.bands.find((b) => total >= b.min) ?? scheme.bands.at(-1)!;
    return { name: s.name, ca, exam, total, grade: band.grade, remark: band.remark };
  });
}

/** Publish all report cards for a term; locks score entry. Idempotent. */
export async function publishTermReports(schoolId: string, termId: string) {
  let [scheme] = await db.select().from(gradingSchemes).where(eq(gradingSchemes.schoolId, schoolId));
  if (!scheme) {
    await db.insert(gradingSchemes).values({ schoolId });
    [scheme] = await db.select().from(gradingSchemes).where(eq(gradingSchemes.schoolId, schoolId));
  }
  const roster = await db.select({ id: students.id }).from(students)
    .where(and(eq(students.schoolId, schoolId), eq(students.status, "active")));
  let published = 0;
  for (const s of roster) {
    const subjectRows = await computeStudent(schoolId, s.id, termId, scheme);
    if (!subjectRows.length) continue;
    const [att] = await db.select({
      present: sql<number>`count(*) filter (where status != 'absent')`,
      total: sql<number>`count(*)`,
    }).from(attendanceRecords)
      .where(and(eq(attendanceRecords.studentId, s.id), eq(attendanceRecords.termId, termId)));
    const data = {
      subjects: subjectRows,
      attendance: { present: Number(att?.present ?? 0), total: Number(att?.total ?? 0) },
    };
    await db.insert(reportCards)
      .values({ id: uid(), schoolId, studentId: s.id, termId, published: true, data, publishedAt: new Date() })
      .onConflictDoUpdate({
        target: [reportCards.studentId, reportCards.termId],
        set: { data, published: true, publishedAt: new Date() },
      });
    published++;
  }
  await db.update(terms).set({ scoresLocked: true }).where(eq(terms.id, termId));
  return published;
}
