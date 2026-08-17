import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  attendanceRecords, classes, students, scores, assessments, subjects,
  feeInvoices, levels,
} from "@/db/schema";
import { requireModule, getCurrentTerm } from "@/core/school-context";
import { Card, DataTable, PageHeader, Tr, Td } from "@/ui/kit";

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

/** Cross-module insight computed live from indexed aggregates (doc 03). */
export default async function Analytics({ params }: { params: Promise<{ school: string }> }) {
  const { school: slug } = await params;
  const { school } = await requireModule(slug, "analytics", ["admin"]);
  const term = await getCurrentTerm(school.id);
  if (!term) return <p>No current term.</p>;

  const [attByClass, avgBySubject, [fees], enrollByLevel] = await Promise.all([
    db.select({
      className: classes.name,
      present: sql<number>`count(*) filter (where status != 'absent')`,
      total: sql<number>`count(*)`,
    }).from(attendanceRecords)
      .innerJoin(classes, eq(attendanceRecords.classId, classes.id))
      .where(and(eq(attendanceRecords.schoolId, school.id), eq(attendanceRecords.termId, term.id)))
      .groupBy(classes.name),
    db.select({
      subject: subjects.name,
      avg: sql<number>`round(avg(${scores.score}::float / ${assessments.maxScore} * 100))`,
      n: sql<number>`count(*)`,
    }).from(scores)
      .innerJoin(assessments, eq(scores.assessmentId, assessments.id))
      .innerJoin(subjects, eq(assessments.subjectId, subjects.id))
      .where(and(eq(scores.schoolId, school.id), eq(assessments.termId, term.id)))
      .groupBy(subjects.name),
    db.select({
      billed: sql<number>`coalesce(sum(total_pesewas),0)`,
      paid: sql<number>`coalesce(sum(paid_pesewas),0)`,
    }).from(feeInvoices)
      .where(and(eq(feeInvoices.schoolId, school.id), eq(feeInvoices.termId, term.id))),
    db.select({ level: levels.name, n: sql<number>`count(*)` })
      .from(students)
      .innerJoin(classes, eq(students.classId, classes.id))
      .innerJoin(levels, eq(classes.levelId, levels.id))
      .where(and(eq(students.schoolId, school.id), eq(students.status, "active")))
      .groupBy(levels.name, levels.sortOrder).orderBy(levels.sortOrder),
  ]);
  const attTotal = attByClass.reduce((a, r) => a + Number(r.total), 0);
  const attPresent = attByClass.reduce((a, r) => a + Number(r.present), 0);

  return (
    <div className="max-w-4xl">
      <PageHeader title="Analytics" sub={`${term.name} · live from your data`} />
      <div className="mb-6 grid grid-cols-3 gap-4">
        <Card><p className="text-sm text-muted-foreground">School attendance rate</p>
          <p className="mt-1 text-3xl font-semibold">{pct(attPresent, attTotal)}</p></Card>
        <Card><p className="text-sm text-muted-foreground">Fee collection rate</p>
          <p className="mt-1 text-3xl font-semibold">{pct(Number(fees.paid), Number(fees.billed))}</p></Card>
        <Card><p className="text-sm text-muted-foreground">Active students</p>
          <p className="mt-1 text-3xl font-semibold">{enrollByLevel.reduce((a, r) => a + Number(r.n), 0)}</p></Card>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-2 font-semibold">Attendance by class</h2>
          <DataTable head={["Class", "Rate"]}>
            {attByClass.map((r) => (
              <Tr key={r.className}><Td>{r.className}</Td>
                <Td>{pct(Number(r.present), Number(r.total))}</Td></Tr>
            ))}
          </DataTable>
        </div>
        <div>
          <h2 className="mb-2 font-semibold">Average score by subject</h2>
          <DataTable head={["Subject", "Avg %", "Entries"]}>
            {avgBySubject.map((r) => (
              <Tr key={r.subject}><Td>{r.subject}</Td><Td>{String(r.avg)}%</Td><Td>{String(r.n)}</Td></Tr>
            ))}
          </DataTable>
        </div>
        <div>
          <h2 className="mb-2 font-semibold">Enrolment by level</h2>
          <DataTable head={["Level", "Students"]}>
            {enrollByLevel.map((r) => (
              <Tr key={r.level}><Td>{r.level}</Td><Td>{String(r.n)}</Td></Tr>
            ))}
          </DataTable>
        </div>
      </div>
    </div>
  );
}
