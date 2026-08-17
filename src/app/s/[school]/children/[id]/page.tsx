import Link from "next/link";
import { and, eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import {
  students, classes, reportCards, terms, feeInvoices, feePayments,
  attendanceRecords, scores, assessments, subjects,
} from "@/db/schema";
import { requireSchool, getCurrentTerm } from "@/core/school-context";
import { assertParentOf } from "@/core/portal";
import { Card, DataTable, PageHeader, Tr, Td } from "@/ui/kit";
import { PayFeesButton } from "@/ui/pay-fees";

const ghs = (p: number) => `GHS ${(p / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

/** Parent child-detail: results, attendance, fees + receipts, reports (doc 10). */
export default async function ChildDetail({ params }: {
  params: Promise<{ school: string; id: string }>;
}) {
  const { school: slug, id } = await params;
  const { school, user } = await requireSchool(slug, ["parent"]);
  if (!(await assertParentOf(school.id, user.id, id)) && user.role !== "platform_admin") notFound();
  const [s] = await db.select().from(students)
    .where(and(eq(students.id, id), eq(students.schoolId, school.id)));
  if (!s) notFound();
  const term = await getCurrentTerm(school.id);
  const [cls] = s.classId ? await db.select().from(classes).where(eq(classes.id, s.classId)) : [null];

  const [att, latestScores, invoices, reports] = await Promise.all([
    term
      ? db.select().from(attendanceRecords).where(and(
          eq(attendanceRecords.studentId, id), eq(attendanceRecords.termId, term.id)))
      : [],
    term
      ? db.select({
          subject: subjects.name, title: assessments.title,
          score: scores.score, max: assessments.maxScore,
        }).from(scores)
          .innerJoin(assessments, eq(scores.assessmentId, assessments.id))
          .innerJoin(subjects, eq(assessments.subjectId, subjects.id))
          .where(and(eq(scores.studentId, id), eq(assessments.termId, term.id)))
          .orderBy(desc(scores.updatedAt)).limit(8)
      : [],
    db.select().from(feeInvoices).where(and(
      eq(feeInvoices.studentId, id), eq(feeInvoices.schoolId, school.id)))
      .orderBy(desc(feeInvoices.createdAt)),
    db.select({ termId: reportCards.termId, name: terms.name })
      .from(reportCards).innerJoin(terms, eq(reportCards.termId, terms.id))
      .where(and(eq(reportCards.studentId, id), eq(reportCards.published, true))),
  ]);
  const payments = invoices.length
    ? await db.select().from(feePayments)
        .where(eq(feePayments.invoiceId, invoices[0].id)).orderBy(desc(feePayments.createdAt))
    : [];
  const present = att.filter((a) => a.status !== "absent").length;

  return (
    <div className="max-w-2xl space-y-5">
      <PageHeader title={`${s.firstName} ${s.lastName}`} sub={`${cls?.name ?? "—"} · ${s.admissionNo}`} />

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <p className="text-sm text-muted-foreground">Attendance this term</p>
          <p className="mt-1 text-2xl font-semibold">
            {att.length ? `${present}/${att.length} days` : "—"}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">Report cards</p>
          <div className="mt-1 space-y-1 text-sm">
            {reports.length === 0 && <p className="text-muted-foreground">None published yet</p>}
            {reports.map((r) => (
              <Link key={r.termId} href={`/students/${id}/report/${r.termId}`}
                className="block text-primary underline-offset-2 hover:underline">
                {r.name} report →
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold">Recent results {term && `(${term.name})`}</h2>
        {latestScores.length === 0
          ? <p className="mt-2 text-sm text-muted-foreground">No scores entered yet.</p>
          : (
            <ul className="mt-2 space-y-1 text-sm">
              {latestScores.map((r, i) => (
                <li key={i} className="flex justify-between">
                  <span>{r.subject} · {r.title}</span>
                  <span className="font-medium">{r.score}/{r.max}</span>
                </li>
              ))}
            </ul>
          )}
      </Card>

      <Card>
        <h2 className="font-semibold">Fees</h2>
        <DataTable head={["Term", "Total", "Paid", "Balance", ""]}>
          {invoices.map((i) => {
            const bal = i.totalPesewas - i.paidPesewas;
            return (
              <Tr key={i.id}>
                <Td>{i.createdAt.toISOString().slice(0, 10)}</Td>
                <Td>{ghs(i.totalPesewas)}</Td>
                <Td className="text-success">{ghs(i.paidPesewas)}</Td>
                <Td className={bal > 0 ? "text-danger" : "text-success"}>{ghs(bal)}</Td>
                <Td>{bal > 0 && <PayFeesButton slug={slug} invoiceId={i.id} maxGhs={bal / 100} />}</Td>
              </Tr>
            );
          })}
        </DataTable>
        {payments.length > 0 && (
          <div className="mt-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Receipts</p>
            {payments.map((p) => (
              <p key={p.id}>{p.createdAt.toISOString().slice(0, 10)} · {ghs(p.amountPesewas)} · {p.method} · ref {p.reference.slice(0, 18)}</p>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
