import { and, eq, sql, inArray } from "drizzle-orm";
import { db } from "@/db";
import { feeStructures, feeInvoices, levels, students, classes } from "@/db/schema";
import { requireModule, getCurrentTerm } from "@/core/school-context";
import { addFeeItem, generateInvoices, recordPayment, sendFeeReminders } from "./actions";
import { Card, DataTable, Field, PageHeader, Tr, Td, inputCls, btnCls, btnGhostCls } from "@/ui/kit";
import { Pagination } from "@/ui/list-controls";
import { PER_PAGE } from "@/lib/utils";

const ghs = (p: number) => `GHS ${(p / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export default async function Fees({ params, searchParams }: {
  params: Promise<{ school: string }>;
  searchParams: Promise<{ page?: string; f?: string }>;
}) {
  const { school: slug } = await params;
  const sp = await searchParams;
  const { school } = await requireModule(slug, "fees", ["admin"]);
  const term = await getCurrentTerm(school.id);
  if (!term) return <p>Set up an academic year first (Settings).</p>;
  const page = Math.max(1, Number(sp.page) || 1);
  const filter = sp.f === "due" ? ["unpaid", "part_paid"] as const : undefined;

  const [items, lvs, totals] = await Promise.all([
    db.select({ id: feeStructures.id, name: feeStructures.name, amount: feeStructures.amountPesewas, level: levels.name })
      .from(feeStructures).leftJoin(levels, eq(feeStructures.levelId, levels.id))
      .where(and(eq(feeStructures.schoolId, school.id), eq(feeStructures.termId, term.id))),
    db.select().from(levels).where(eq(levels.schoolId, school.id)).orderBy(levels.sortOrder),
    db.select({
      billed: sql<number>`coalesce(sum(total_pesewas),0)`,
      paid: sql<number>`coalesce(sum(paid_pesewas),0)`,
      n: sql<number>`count(*)`,
    }).from(feeInvoices)
      .where(and(eq(feeInvoices.schoolId, school.id), eq(feeInvoices.termId, term.id))),
  ]);
  const invWhere = and(
    eq(feeInvoices.schoolId, school.id), eq(feeInvoices.termId, term.id),
    filter ? inArray(feeInvoices.status, [...filter]) : undefined);
  const [invoices, [{ n: invCount }]] = await Promise.all([
    db.select({
      id: feeInvoices.id, total: feeInvoices.totalPesewas, paid: feeInvoices.paidPesewas,
      status: feeInvoices.status, firstName: students.firstName, lastName: students.lastName,
      className: classes.name,
    }).from(feeInvoices)
      .innerJoin(students, eq(feeInvoices.studentId, students.id))
      .leftJoin(classes, eq(students.classId, classes.id))
      .where(invWhere).orderBy(students.lastName)
      .limit(PER_PAGE).offset((page - 1) * PER_PAGE),
    db.select({ n: sql<number>`count(*)` }).from(feeInvoices).where(invWhere),
  ]);
  const t = totals[0];

  return (
    <div className="max-w-4xl">
      <PageHeader title="Fees" sub={`${term.name} · ${t.n} invoices`}
        action={
          <form action={sendFeeReminders.bind(null, slug)}>
            <button className={btnCls}>SMS defaulters</button>
          </form>
        } />
      <div className="mb-5 grid grid-cols-3 gap-4">
        <Card><p className="text-sm text-muted-foreground">Billed</p><p className="mt-1 text-2xl font-semibold">{ghs(Number(t.billed))}</p></Card>
        <Card><p className="text-sm text-muted-foreground">Collected</p><p className="mt-1 text-2xl font-semibold text-success">{ghs(Number(t.paid))}</p></Card>
        <Card><p className="text-sm text-muted-foreground">Outstanding</p><p className="mt-1 text-2xl font-semibold text-danger">{ghs(Number(t.billed) - Number(t.paid))}</p></Card>
      </div>

      <Card className="mb-5">
        <h2 className="font-semibold">Fee structure ({term.name})</h2>
        <ul className="mt-2 text-sm text-muted-foreground">
          {items.map((i) => <li key={i.id}>{i.level}: {i.name} — {ghs(i.amount)}</li>)}
        </ul>
        <form action={addFeeItem.bind(null, slug)} className="mt-3 flex items-end gap-2">
          <Field label="Level">
            <select name="levelId" className={inputCls}>{lvs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
          </Field>
          <Field label="Item"><input name="name" placeholder="Tuition" required className={inputCls} /></Field>
          <Field label="Amount (GHS)"><input name="amountGhs" type="number" step="0.01" required className={inputCls + " w-28"} /></Field>
          <button className={btnGhostCls}>Add item</button>
        </form>
        <form action={generateInvoices.bind(null, slug)} className="mt-3">
          <button className={btnCls}>Generate invoices for all students</button>
        </form>
      </Card>

      <div className="mb-3 flex gap-2 text-sm">
        <a href="?" className={!filter ? btnCls : btnGhostCls}>All</a>
        <a href="?f=due" className={filter ? btnCls : btnGhostCls}>Defaulters</a>
      </div>
      <DataTable head={["Student", "Class", "Total", "Paid", "Status", "Record payment"]}>
        {invoices.map((i) => (
          <Tr key={i.id}>
            <Td className="font-medium">{i.lastName}, {i.firstName}</Td>
            <Td>{i.className}</Td>
            <Td>{ghs(i.total)}</Td><Td>{ghs(i.paid)}</Td>
            <Td><span className={i.status === "paid" ? "text-success" : i.status === "part_paid" ? "text-warning" : "text-danger"}>{i.status}</span></Td>
            <Td>
              {i.status !== "paid" && (
                <form action={recordPayment.bind(null, slug, i.id)} className="flex items-center gap-1">
                  <input name="amountGhs" type="number" step="0.01" placeholder="GHS"
                    className="w-20 rounded-md border border-border px-2 py-1 text-xs" />
                  <select name="method" className="rounded-md border border-border px-1 py-1 text-xs">
                    <option value="cash">cash</option><option value="momo">momo</option>
                  </select>
                  <button className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground">✓</button>
                </form>
              )}
            </Td>
          </Tr>
        ))}
      </DataTable>
      <Pagination page={page} count={Number(invCount)} />
    </div>
  );
}
