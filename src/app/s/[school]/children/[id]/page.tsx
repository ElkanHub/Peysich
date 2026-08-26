import Link from "next/link";
import { and, eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import {
  students, classes, reportCards, terms, feeInvoices, feePayments,
  attendanceRecords, subjects, componentScores, assessmentComponents,
  scorePublications, scoreSheets,
} from "@/db/schema";
import { requireSchool, getCurrentTerm } from "@/core/school-context";
import { assertParentOf } from "@/core/portal";
import { Card, DataTable, PageHeader, Tr, Td } from "@/ui/kit";

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
          subject: subjects.name, title: assessmentComponents.name,
          weight: assessmentComponents.weight, raw: componentScores.raw,
          absent: componentScores.absent,
          componentId: componentScores.componentId, subjectId: componentScores.subjectId,
          classId: componentScores.classId,
        }).from(componentScores)
          .innerJoin(assessmentComponents, eq(componentScores.componentId, assessmentComponents.id))
          .innerJoin(subjects, eq(componentScores.subjectId, subjects.id))
          // families only see what the school has published
          .innerJoin(scorePublications, and(
            eq(scorePublications.componentId, componentScores.componentId),
            eq(scorePublications.termId, componentScores.termId)))
          .where(and(eq(componentScores.studentId, id), eq(componentScores.termId, term.id)))
          .orderBy(desc(componentScores.updatedAt)).limit(12)
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
  const sheetRows = term && s.classId
    ? await db.select().from(scoreSheets).where(and(
        eq(scoreSheets.termId, term.id), eq(scoreSheets.classId, s.classId)))
    : [];
  const sheetOutOf = new Map(sheetRows.map((sh) => [`${sh.subjectId}:${sh.componentId}`, sh.outOf]));

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
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Released results {term && `(${term.name})`}</h2>
          {term && latestScores.length > 0 && (
            <Link href={`/students/${id}/performance/${term.id}`}
              className="text-[14px] font-medium text-primary">Full record →</Link>
          )}
        </div>
        {latestScores.length === 0
          ? <p className="mt-2 text-sm text-muted-foreground">Nothing released yet — results appear here as the school publishes each test.</p>
          : (
            <ul className="mt-2 space-y-1 text-sm">
              {latestScores.map((r, i) => {
                const outOf = sheetOutOf.get(`${r.subjectId}:${r.componentId}`) ?? 100;
                const conv = Math.round((r.raw / outOf) * r.weight * 10) / 10;
                return (
                  <li key={i} className="flex justify-between">
                    <span>{r.subject} · {r.title}</span>
                    <span className="font-medium" data-nums="">
                      {r.absent ? <span className="text-muted-foreground" title="Did not write">–</span> : `${conv}/${r.weight}`}
                    </span>
                  </li>
                );
              })}
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
                <Td><Link href={`/fees?child=${id}`} className="text-[12.5px] font-medium text-primary">
                  {bal > 0 ? "how to pay →" : "details →"}</Link></Td>
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
