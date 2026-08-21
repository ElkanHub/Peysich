import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  componentScores, scoreSheets, assessmentComponents, gradingSchemes, reportCards,
  students, subjects, attendanceRecords, terms, classes, levels, skillDomains, skillRatings,
} from "@/db/schema";
import { uid } from "@/lib/utils";

type Scheme = { caWeight: number; examWeight: number; bands: { min: number; grade: string; remark: string }[] };

/** Totals from the configurable scheme: each raw mark converts to its
 *  component's weight (raw ÷ marked-over × weight); CA = the tests, exam =
 *  the exam component — together they land on /100 by construction. */
async function computeStudent(
  schoolId: string, studentId: string, termId: string, scheme: Scheme,
  /** every subject the class studies — empty ones stay on the report as blanks */
  effectiveSubjects: { id: string; name: string }[],
) {
  const rows = await db.select({
    subjectId: componentScores.subjectId, raw: componentScores.raw,
    classId: componentScores.classId, componentId: componentScores.componentId,
    weight: assessmentComponents.weight, isExam: assessmentComponents.isExam,
    subjectName: subjects.name,
  }).from(componentScores)
    .innerJoin(assessmentComponents, eq(componentScores.componentId, assessmentComponents.id))
    .innerJoin(subjects, eq(componentScores.subjectId, subjects.id))
    .where(and(eq(componentScores.schoolId, schoolId),
      eq(componentScores.studentId, studentId), eq(componentScores.termId, termId)));
  if (!rows.length && !effectiveSubjects.length) return [];
  const sheets = await db.select().from(scoreSheets)
    .where(and(eq(scoreSheets.schoolId, schoolId), eq(scoreSheets.termId, termId)));
  const outOfBy = new Map(sheets.map((s) => [`${s.classId}:${s.subjectId}:${s.componentId}`, s.outOf]));

  const bySubject = new Map<string, { name: string; ca: number; exam: number }>();
  for (const r of rows) {
    const s = bySubject.get(r.subjectId) ?? { name: r.subjectName, ca: 0, exam: 0 };
    const outOf = outOfBy.get(`${r.classId}:${r.subjectId}:${r.componentId}`) ?? 100;
    const conv = (r.raw / outOf) * r.weight;
    if (r.isExam) s.exam += conv; else s.ca += conv;
    bySubject.set(r.subjectId, s);
  }
  const scored = [...bySubject.entries()].map(([sid, s]) => {
    const ca = Math.round(s.ca);
    const exam = Math.round(s.exam);
    const total = ca + exam;
    const band = scheme.bands.find((b) => total >= b.min) ?? scheme.bands.at(-1)!;
    return { sid, row: { name: s.name, ca, exam, total, grade: band.grade, remark: band.remark } };
  });
  const scoredBy = new Map(scored.map((s) => [s.sid, s.row]));
  // full subject list, in name order; unmarked subjects appear empty
  const all = effectiveSubjects.length ? effectiveSubjects : scored.map((s) => ({ id: s.sid, name: s.row.name }));
  return all
    .map((sub) => scoredBy.get(sub.id)
      ?? { name: sub.name, ca: 0, exam: 0, total: 0, grade: "", remark: "", empty: true })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Publish all report cards for a term; locks score entry. Idempotent. */
export async function publishTermReports(schoolId: string, termId: string) {
  let [scheme] = await db.select().from(gradingSchemes).where(eq(gradingSchemes.schoolId, schoolId));
  if (!scheme) {
    await db.insert(gradingSchemes).values({ schoolId });
    [scheme] = await db.select().from(gradingSchemes).where(eq(gradingSchemes.schoolId, schoolId));
  }
  const roster = await db.select({ id: students.id, classId: students.classId }).from(students)
    .where(and(eq(students.schoolId, schoolId), eq(students.status, "active")));
  const cls = await db.select().from(classes).where(eq(classes.schoolId, schoolId));
  const lvs = await db.select().from(levels).where(eq(levels.schoolId, schoolId));
  const preschoolClass = new Set(cls
    .filter((c) => lvs.find((l) => l.id === c.levelId)?.preschool).map((c) => c.id));
  const domains = await db.select().from(skillDomains).where(eq(skillDomains.schoolId, schoolId));
  const domainName = new Map(domains.map((d) => [d.id, d.name]));
  const { getStructure } = await import("@/core/academics");
  const S = await getStructure(schoolId);
  let published = 0;
  for (const s of roster) {
    const isPre = !!(s.classId && preschoolClass.has(s.classId));
    const effective = s.classId && !isPre
      ? S.effectiveSubjectIds(s.classId)
          .map((id) => ({ id, name: S.subjectById.get(id)?.name ?? "" }))
      : [];
    const subjectRows = await computeStudent(schoolId, s.id, termId, scheme, effective);
    let skills: { domain: string; rating: string }[] | undefined;
    if (isPre) {
      const rs = await db.select().from(skillRatings).where(and(
        eq(skillRatings.studentId, s.id), eq(skillRatings.termId, termId)));
      skills = rs.map((r) => ({ domain: domainName.get(r.domainId) ?? "", rating: r.rating }));
    }
    // skip only students with NOTHING at all this term (no marks in any subject)
    if (!subjectRows.some((r) => !("empty" in r && r.empty)) && !skills?.length) continue;
    const [att] = await db.select({
      present: sql<number>`count(*) filter (where status != 'absent')`,
      total: sql<number>`count(*)`,
    }).from(attendanceRecords)
      .where(and(eq(attendanceRecords.studentId, s.id), eq(attendanceRecords.termId, termId)));
    const data = {
      subjects: subjectRows,
      attendance: { present: Number(att?.present ?? 0), total: Number(att?.total ?? 0) },
      ...(skills?.length ? { skills } : {}),
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

/** Preschool-only release: skills-based reports for every rated preschool
 *  child. End-of-term by nature (their whole assessment is the skills grid),
 *  but it does NOT lock the term — the rest of the school keeps working. */
export async function publishPreschoolReports(schoolId: string, termId: string) {
  const [cls, lvs, domains] = await Promise.all([
    db.select().from(classes).where(eq(classes.schoolId, schoolId)),
    db.select().from(levels).where(eq(levels.schoolId, schoolId)),
    db.select().from(skillDomains).where(eq(skillDomains.schoolId, schoolId)),
  ]);
  const preschoolClass = new Set(cls
    .filter((c) => lvs.find((l) => l.id === c.levelId)?.preschool).map((c) => c.id));
  const domainName = new Map(domains.map((d) => [d.id, d.name]));
  const roster = (await db.select({ id: students.id, classId: students.classId }).from(students)
    .where(and(eq(students.schoolId, schoolId), eq(students.status, "active"))))
    .filter((s) => s.classId && preschoolClass.has(s.classId));

  let published = 0;
  for (const s of roster) {
    const rs = await db.select().from(skillRatings).where(and(
      eq(skillRatings.studentId, s.id), eq(skillRatings.termId, termId)));
    if (!rs.length) continue; // nothing rated yet — no empty report
    const [att] = await db.select({
      present: sql<number>`count(*) filter (where status != 'absent')`,
      total: sql<number>`count(*)`,
    }).from(attendanceRecords)
      .where(and(eq(attendanceRecords.studentId, s.id), eq(attendanceRecords.termId, termId)));
    const data = {
      subjects: [],
      attendance: { present: Number(att?.present ?? 0), total: Number(att?.total ?? 0) },
      skills: rs.map((r) => ({ domain: domainName.get(r.domainId) ?? "", rating: r.rating })),
    };
    await db.insert(reportCards)
      .values({ id: uid(), schoolId, studentId: s.id, termId, published: true, data, publishedAt: new Date() })
      .onConflictDoUpdate({
        target: [reportCards.studentId, reportCards.termId],
        set: { data, published: true, publishedAt: new Date() },
      });
    published++;
  }
  return published;
}
