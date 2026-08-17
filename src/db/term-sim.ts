import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { schools, terms, classes, subjects, students, assessments, scores, attendanceRecords, reportCards } from "@/db/schema";
import { publishTermReports } from "@/modules/assessment/publish";
import { uid } from "@/lib/utils";

async function main() {
  const [school] = await db.select().from(schools).where(eq(schools.slug, "stmarys"));
  const [term] = await db.select().from(terms).where(and(eq(terms.schoolId, school.id), eq(terms.isCurrent, true)));
  const cls = await db.select().from(classes).where(eq(classes.schoolId, school.id));
  const subs = await db.select().from(subjects).where(eq(subjects.schoolId, school.id));
  let r = 42; const rand = () => (r = (r * 16807) % 2147483647) / 2147483647;
  // attendance: 10 school days for every class
  for (const c of cls) {
    const roster = await db.select().from(students).where(and(eq(students.classId, c.id), eq(students.status, "active")));
    for (let d = 1; d <= 10; d++) {
      const date = `2026-02-${String(d).padStart(2, "0")}`;
      await db.insert(attendanceRecords).values(roster.map((s) => ({
        id: uid(), schoolId: school.id, studentId: s.id, classId: c.id, termId: term.id,
        date, status: rand() > 0.07 ? "present" : "absent", markedBy: "test",
      }))).onConflictDoNothing();
    }
    // 2 CAs + 1 exam per subject, scores for all students
    for (const su of subs) {
      for (const [kind, title, max] of [["ca","CA 1",20],["ca","CA 2",30],["exam","End of Term Exam",100]] as const) {
        const aid = uid();
        await db.insert(assessments).values({ id: aid, schoolId: school.id, termId: term.id, classId: c.id, subjectId: su.id, kind, title, maxScore: max, createdBy: "test" });
        await db.insert(scores).values(roster.map((s) => ({
          assessmentId: aid, studentId: s.id, schoolId: school.id,
          score: Math.floor(max * (0.35 + rand() * 0.6)), enteredBy: "test",
        }))).onConflictDoNothing();
      }
    }
  }
  const n = await publishTermReports(school.id, term.id);
  const [chk] = await db.select({ n: sql<number>`count(*)` }).from(reportCards)
    .where(and(eq(reportCards.schoolId, school.id), eq(reportCards.published, true)));
  console.log(`published=${n} inDb=${chk.n}`);
  const [sample] = await db.select().from(reportCards).where(eq(reportCards.schoolId, school.id)).limit(1);
  console.log("sample subjects:", sample.data.subjects.length, "attendance:", JSON.stringify(sample.data.attendance));
  console.log("sampleStudent=" + sample.studentId + " term=" + sample.termId);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
