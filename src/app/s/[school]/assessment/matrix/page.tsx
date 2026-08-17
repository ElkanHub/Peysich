import Link from "next/link";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { classes, subjects, students, assessments, scores, reportCards } from "@/db/schema";
import { requireModule, getCurrentTerm } from "@/core/school-context";
import { publishReports } from "../actions";
import { PageHeader, btnCls } from "@/ui/kit";
import { cn } from "@/lib/utils";

/** Term-closing completeness matrix (doc 10, the killer admin screen):
 *  class × subject cells green/amber/red by % of scores entered. */
export default async function Matrix({ params }: { params: Promise<{ school: string }> }) {
  const { school: slug } = await params;
  const { school } = await requireModule(slug, "assessment", ["admin"]);
  const term = await getCurrentTerm(school.id);
  if (!term) return <p>No current term.</p>;

  const [cls, subs, rosters, entered, published] = await Promise.all([
    db.select().from(classes).where(eq(classes.schoolId, school.id)),
    db.select().from(subjects).where(eq(subjects.schoolId, school.id)),
    db.select({ classId: students.classId, n: sql<number>`count(*)` }).from(students)
      .where(and(eq(students.schoolId, school.id), eq(students.status, "active")))
      .groupBy(students.classId),
    db.select({
      classId: assessments.classId, subjectId: assessments.subjectId,
      n: sql<number>`count(distinct ${scores.studentId})`,
    }).from(scores)
      .innerJoin(assessments, eq(scores.assessmentId, assessments.id))
      .where(and(eq(assessments.schoolId, school.id), eq(assessments.termId, term.id)))
      .groupBy(assessments.classId, assessments.subjectId),
    db.select({ n: sql<number>`count(*)` }).from(reportCards)
      .where(and(eq(reportCards.schoolId, school.id), eq(reportCards.termId, term.id),
        eq(reportCards.published, true))),
  ]);
  const rosterN = new Map(rosters.map((r) => [r.classId, Number(r.n)]));
  const cell = new Map(entered.map((e) => [`${e.classId}:${e.subjectId}`, Number(e.n)]));

  return (
    <div>
      <PageHeader title="Term closing" sub={`${term.name} · score entry completeness`}
        action={
          <form action={publishReports.bind(null, slug)}>
            <button className={btnCls}>{term.scoresLocked ? "Re-publish report cards" : "Publish report cards"}</button>
          </form>
        } />
      {Number(published[0]?.n) > 0 && (
        <p className="mb-3 text-sm text-success">{String(published[0].n)} report cards published — parents can view them. Scores are locked.</p>
      )}
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="text-xs">
          <thead>
            <tr><th className="px-3 py-2 text-left">Class</th>
              {subs.map((s) => <th key={s.id} className="px-2 py-2 font-medium">{s.name.split(" ")[0]}</th>)}
            </tr>
          </thead>
          <tbody>
            {cls.map((c) => {
              const total = rosterN.get(c.id) ?? 0;
              return (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-3 py-1.5 font-medium">{c.name}</td>
                  {subs.map((s) => {
                    const n = cell.get(`${c.id}:${s.id}`) ?? 0;
                    const pct = total ? n / total : 0;
                    return (
                      <td key={s.id} className="px-1 py-1.5 text-center">
                        <Link href={`/assessment/${c.id}/${s.id}`}
                          className={cn("inline-block w-12 rounded py-1",
                            pct >= 1 ? "bg-success/15 text-success"
                              : pct > 0 ? "bg-warning/15 text-warning"
                              : "bg-danger/10 text-danger")}>
                          {n}/{total}
                        </Link>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
