import Link from "next/link";
import { and, eq, sql, inArray, gte } from "drizzle-orm";
import { Settings2 } from "lucide-react";
import { db } from "@/db";
import {
  feeInvoices, feeInvoiceLines, feePayments, ledgerEntries, students, classes,
  levels, user as userTable,
} from "@/db/schema";
import { requireModule, getCurrentTerm } from "@/core/school-context";
import { getParentChildren } from "@/core/portal";
import { canFeeAction } from "@/core/access";
import { getFeesConfig, ghs } from "@/modules/fees/config";
import { HowToPay } from "@/modules/fees/how-to-pay";
import { generateInvoices, sendFeeReminders } from "./actions";
import { Card, PageHeader, Stat, Empty, Badge, btnCls, btnGhostCls } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";
import { ChildAvatar } from "@/ui/child-avatar";

const ERR: Record<string, string> = {
  notallowed: "Your access doesn't cover that money action — ask a full admin under Settings → Team & access.",
};

export default async function Fees({ params, searchParams }: {
  params: Promise<{ school: string }>;
  searchParams: Promise<{ c?: string; f?: string; child?: string; err?: string }>;
}) {
  const { school: slug } = await params;
  const sp = await searchParams;
  const { school, user } = await requireModule(slug, "fees");
  const term = await getCurrentTerm(school.id);
  const cfg = getFeesConfig(school.settings);
  if (!term) return <Empty title="No academic year yet" hint="Set up your year and terms in Settings first." />;
  const today = new Date().toISOString().slice(0, 10);

  // ═══ parent: the fee stub — everything about their children's money ═══
  if (user.role === "parent") {
    const kids = (await getParentChildren(school.id, user.id, term.id)).filter((k) => k.classId);
    if (!kids.length) return <Empty title="No children linked" hint="Please contact the school office." />;
    const active = kids.find((k) => k.id === sp.child) ?? kids[0];
    const [[inv], ledger] = await Promise.all([
      db.select().from(feeInvoices).where(and(
        eq(feeInvoices.studentId, active.id), eq(feeInvoices.termId, term.id))),
      db.select().from(ledgerEntries).where(and(
        eq(ledgerEntries.schoolId, school.id), eq(ledgerEntries.studentId, active.id)))
        .orderBy(ledgerEntries.at),
    ]);
    const [lines, pays] = await Promise.all([
      inv ? db.select().from(feeInvoiceLines).where(eq(feeInvoiceLines.invoiceId, inv.id))
        .orderBy(feeInvoiceLines.sortOrder) : Promise.resolve([]),
      db.select({
        id: feePayments.id, amountPesewas: feePayments.amountPesewas, method: feePayments.method,
        receiptNo: feePayments.receiptNo, createdAt: feePayments.createdAt, voidedAt: feePayments.voidedAt,
        invoiceId: feePayments.invoiceId, studentId: feeInvoices.studentId,
      }).from(feePayments)
        .innerJoin(feeInvoices, eq(feePayments.invoiceId, feeInvoices.id))
        .where(and(eq(feePayments.schoolId, school.id), eq(feeInvoices.studentId, active.id)))
        .orderBy(sql`${feePayments.createdAt} desc`),
    ]);
    const owing = inv ? Math.max(0, inv.totalPesewas - inv.paidPesewas) : 0;
    const paidShare = inv && inv.totalPesewas > 0 ? Math.min(100, Math.round((inv.paidPesewas / inv.totalPesewas) * 100)) : 0;
    const daysLeft = inv?.dueDate ? Math.ceil((Date.parse(inv.dueDate) - Date.parse(today)) / 86400000) : null;
    let running = 0;

    return (
      <div className="max-w-3xl">
        <PageHeader title="Fees" sub="Your children's bills, receipts and history — one place, per child" />
        <div className="mb-4 flex flex-wrap gap-2">
          {kids.map((k) => {
            const isActive = k.id === active.id;
            return (
              <Link key={k.id} href={`/fees?child=${k.id}`} aria-current={isActive ? "true" : undefined}
                className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-3.5 text-[13.5px] font-medium transition-colors ${isActive
                  ? "bg-brand-container text-on-brand-container shadow-[var(--shadow-sm)] ring-2 ring-primary/35 ring-offset-2 ring-offset-background"
                  : "border border-border hover:bg-muted"}`}>
                <ChildAvatar photoUrl={k.photoUrl} initials={`${k.firstName[0]}${k.lastName[0]}`}
                  owing={k.owingPesewas > 0} className="h-7 w-7 text-[11px]" />
                <span className="min-w-0">
                  {k.firstName}
                  <span className={isActive ? "ml-1 opacity-80" : "ml-1 text-muted-foreground"}>· {k.className}</span>
                  {isActive && <span className="ml-1.5 text-[10.5px] font-bold uppercase tracking-wider opacity-90">open</span>}
                </span>
              </Link>
            );
          })}
        </div>

        <Card className="mb-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {term.year?.name} · {term.name} — {active.firstName} {active.lastName}
              </p>
              {inv ? (
                <>
                  <p className={`text-[30px] font-bold tracking-tight ${owing ? "text-danger" : "text-success"}`} data-nums="">
                    {owing ? ghs(owing) : "Cleared ✓"}
                    {owing > 0 && <span className="ml-2 text-[14px] font-medium text-muted-foreground">outstanding</span>}
                  </p>
                  {inv.dueDate && owing > 0 && (
                    <Badge tone={daysLeft !== null && daysLeft < 0 ? "danger" : "warning"}>
                      {daysLeft !== null && daysLeft < 0 ? `was due ${inv.dueDate}` : `due ${inv.dueDate}${daysLeft !== null ? ` · ${daysLeft} days left` : ""}`}
                    </Badge>
                  )}
                </>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">No bill for this term yet.</p>
              )}
            </div>
            {inv && (
              <div className="flex flex-wrap gap-2">
                <a href="#howtopay" className={btnCls}>How to pay</a>
                <a href={`/api/fees/pdf/invoice/${inv.id}`} target="_blank" className={btnGhostCls}>Download invoice (PDF)</a>
                <Link href={`/fees/invoice/${inv.id}`} className={btnGhostCls}>View / print</Link>
              </div>
            )}
          </div>
          {inv && inv.totalPesewas > 0 && (
            <>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-border/70">
                <div className="h-full rounded-full bg-success" style={{ width: `${paidShare}%` }} />
              </div>
              <p className="mt-1 text-[12.5px] text-muted-foreground" data-nums="">
                Paid {ghs(inv.paidPesewas)} of {ghs(inv.totalPesewas)}
              </p>
            </>
          )}
        </Card>

        <div className="grid items-start gap-4 md:grid-cols-2">
          <Card>
            <h2 className="font-semibold">This term&apos;s bill</h2>
            {lines.length ? (
              <table className="mt-2 w-full text-sm" data-nums="">
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id} className="border-b border-border last:border-0">
                      <td className={`py-1.5 ${l.amountPesewas < 0 ? "text-success" : ""}`}>
                        {l.label}
                        {l.source === "carry_forward" && <span className="ml-1.5 rounded-full bg-brand-soft px-1.5 py-0.5 text-[10.5px] font-medium text-primary">previous term</span>}
                      </td>
                      <td className={`py-1.5 text-right ${l.amountPesewas < 0 ? "text-success" : ""}`}>
                        {(l.amountPesewas / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  <tr className="font-semibold"><td className="py-1.5">Total</td>
                    <td className="py-1.5 text-right">{inv ? (inv.totalPesewas / 100).toFixed(2) : ""}</td></tr>
                  <tr className="text-success"><td className="py-1.5">Paid so far</td>
                    <td className="py-1.5 text-right">{inv ? (inv.paidPesewas / 100).toFixed(2) : ""}</td></tr>
                  <tr className={`font-semibold ${owing ? "text-danger" : "text-success"}`}>
                    <td className="py-1.5">Left to pay</td>
                    <td className="py-1.5 text-right">{(owing / 100).toFixed(2)}</td></tr>
                </tbody>
              </table>
            ) : <p className="mt-2 text-sm text-muted-foreground">The bill appears here once the school issues it.</p>}
          </Card>
          <div id="howtopay"><HowToPay cfg={cfg} schoolName={school.name} /></div>
        </div>

        <Card className="mt-4">
          <h2 className="font-semibold">Receipts</h2>
          <ul className="mt-2 divide-y divide-border text-sm" data-nums="">
            {pays.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                <span className={p.voidedAt ? "line-through opacity-60" : ""}>
                  <b>{p.receiptNo ?? "—"}</b>
                  <span className="ml-2 text-muted-foreground">{p.createdAt.toISOString().slice(0, 10)} · {ghs(p.amountPesewas)} · {p.method}</span>
                  {p.voidedAt && <Badge tone="danger">void</Badge>}
                </span>
                <span className="flex gap-2 text-[12.5px] font-medium">
                  <Link href={`/fees/receipt/${p.id}`} className="text-primary">View / print</Link>
                  <a href={`/api/fees/pdf/receipt/${p.id}`} target="_blank" className="text-primary">PDF</a>
                </span>
              </li>
            ))}
            {!pays.length && <li className="py-1.5 text-muted-foreground">Payments the office records show here instantly.</li>}
          </ul>
          <details className="mt-3">
            <summary className="cursor-pointer text-[13px] font-medium text-primary">Full statement</summary>
            <div className="overflow-x-auto"><table className="min-w-[520px] mt-2 w-full text-[13px]" data-nums="">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="py-1">Date</th><th>Item</th><th className="text-right">Debit</th><th className="text-right">Credit</th><th className="text-right">Balance</th></tr></thead>
              <tbody>
                {ledger.map((e) => {
                  running += e.debitPesewas - e.creditPesewas;
                  return (
                    <tr key={e.id} className="border-b border-border last:border-0">
                      <td className="py-1">{e.at.toISOString().slice(0, 10)}</td>
                      <td className="max-w-44 truncate pr-2">{e.memo}</td>
                      <td className="text-right">{e.debitPesewas ? (e.debitPesewas / 100).toFixed(2) : ""}</td>
                      <td className="text-right text-success">{e.creditPesewas ? (e.creditPesewas / 100).toFixed(2) : ""}</td>
                      <td className="text-right font-medium">{(running / 100).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          </details>
        </Card>
      </div>
    );
  }

  // ═══ admin: the fees desk ═══
  const canGenerate = await canFeeAction(school.id, user.id, user.role, "generate");
  const canCatalog = await canFeeAction(school.id, user.id, user.role, "catalog");
  const [totals, invRows, roster, cls, todayPays] = await Promise.all([
    db.select({
      billed: sql<number>`coalesce(sum(total_pesewas),0)`,
      paid: sql<number>`coalesce(sum(paid_pesewas),0)`,
      n: sql<number>`count(*)`,
    }).from(feeInvoices)
      .where(and(eq(feeInvoices.schoolId, school.id), eq(feeInvoices.termId, term.id))),
    db.select({
      id: feeInvoices.id, total: feeInvoices.totalPesewas, paid: feeInvoices.paidPesewas,
      status: feeInvoices.status, dueDate: feeInvoices.dueDate, studentId: feeInvoices.studentId,
    }).from(feeInvoices)
      .where(and(eq(feeInvoices.schoolId, school.id), eq(feeInvoices.termId, term.id))),
    db.select({ id: students.id, firstName: students.firstName, lastName: students.lastName, classId: students.classId })
      .from(students).where(and(eq(students.schoolId, school.id), eq(students.status, "active"))),
    db.select({ id: classes.id, name: classes.name, sortOrder: levels.sortOrder })
      .from(classes).innerJoin(levels, eq(classes.levelId, levels.id))
      .where(eq(classes.schoolId, school.id)),
    db.select({
      amountPesewas: feePayments.amountPesewas, method: feePayments.method,
      recordedBy: feePayments.recordedBy, voidedAt: feePayments.voidedAt,
    }).from(feePayments).where(and(
      eq(feePayments.schoolId, school.id),
      gte(feePayments.createdAt, new Date(today + "T00:00:00")))),
  ]);
  const t = totals[0];
  const invByStudent = new Map(invRows.map((i) => [i.studentId, i]));
  const overdue = invRows.filter((i) => i.status !== "paid" && i.dueDate && i.dueDate < today);
  const clsOrdered = [...cls].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .filter((c) => roster.some((r) => r.classId === c.id));
  const activeCls = clsOrdered.find((c) => c.id === sp.c) ?? clsOrdered[0];
  const classRoster = roster.filter((r) => r.classId === activeCls?.id)
    .sort((a, b) => a.lastName.localeCompare(b.lastName));
  const shown = sp.f === "due"
    ? classRoster.filter((r) => { const i = invByStudent.get(r.id); return i && i.status !== "paid"; })
    : classRoster;
  const live = todayPays.filter((p) => !p.voidedAt);
  const todayTotal = live.reduce((a, p) => a + p.amountPesewas, 0);
  // day-close: per cashier per method
  const cashierIds = [...new Set(live.map((p) => p.recordedBy).filter(Boolean))] as string[];
  const cashierNames = cashierIds.length
    ? new Map((await db.select({ id: userTable.id, name: userTable.name }).from(userTable)
        .where(inArray(userTable.id, cashierIds))).map((u) => [u.id, u.name]))
    : new Map<string, string>();
  const byCashier = new Map<string, { cash: number; other: number; n: number }>();
  for (const p of live) {
    const k = p.recordedBy ?? "—";
    const row = byCashier.get(k) ?? { cash: 0, other: 0, n: 0 };
    if (p.method === "cash") row.cash += p.amountPesewas; else row.other += p.amountPesewas;
    row.n++; byCashier.set(k, row);
  }

  return (
    <div className="max-w-4xl">
      <PageHeader title="Fees"
        sub={`${term.year?.name} · ${term.name} · ${Number(t.n)} invoices${Number(t.n) ? " — lines frozen at issue" : ""}`}
        action={canCatalog ? { href: "/fees/setup", label: "Catalog & settings" } : undefined} />
      {sp.err && ERR[sp.err] && (
        <p className="mb-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{ERR[sp.err]}</p>
      )}

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Collected this term" value={ghs(Number(t.paid))} tone="success" />
        <Stat label="Outstanding" value={ghs(Number(t.billed) - Number(t.paid))}
          tone={Number(t.billed) > Number(t.paid) ? "danger" : "success"} />
        <Stat label="Defaulters (past due)" value={String(overdue.length)}
          tone={overdue.length ? "danger" : "success"} />
        <Stat label="Collected today" value={ghs(todayTotal)} />
      </div>

      {overdue.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/60 bg-warning-soft px-4 py-2.5 text-[13.5px]">
          <span><b>{overdue.length}</b> student{overdue.length === 1 ? " is" : "s are"} past the due date.</span>
          <form action={sendFeeReminders.bind(null, slug)}>
            <SubmitButton className={btnCls + " bg-warning"} pendingText="Sending…">
              Send SMS reminders to their guardians
            </SubmitButton>
          </form>
        </div>
      )}

      {Number(t.n) === 0 && (
        <Card className="mb-5">
          <h2 className="font-semibold">No invoices for {term.name} yet</h2>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            Set the catalog first{canCatalog && <> (<Link href="/fees/setup" className="font-medium text-primary">Catalog &amp; settings</Link>)</>},
            then generate. Every child gets frozen line items, arrears carried forward, and a due date
            {cfg.dueWeeks ? ` ${cfg.dueWeeks} weeks into the term` : ""}.
          </p>
          {canGenerate && (
            <form action={generateInvoices.bind(null, slug)} className="mt-3">
              <SubmitButton className={btnCls} pendingText="Generating…">Generate {term.name} invoices</SubmitButton>
            </form>
          )}
        </Card>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {clsOrdered.map((c) => (
          <Link key={c.id} href={`/fees?c=${c.id}${sp.f ? `&f=${sp.f}` : ""}`}
            className={`rounded-full px-3 py-1 text-[13px] font-medium ${c.id === activeCls?.id
              ? "bg-brand-container text-on-brand-container" : "border border-border hover:bg-muted"}`}>
            {c.name}
          </Link>
        ))}
        <Link href={`/fees?c=${activeCls?.id ?? ""}${sp.f ? "" : "&f=due"}`}
          className={`ml-auto rounded-full px-3 py-1 text-[13px] font-medium ${sp.f
            ? "bg-warning text-white" : "border border-border hover:bg-muted"}`}>
          {sp.f ? "Showing owing only" : "Only owing"}
        </Link>
      </div>

      <Card>
        <div className="overflow-x-auto"><table className="min-w-[600px] w-full text-sm" data-nums="">
          <thead><tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <th className="py-1.5">Student</th><th className="text-right">Billed</th>
            <th className="text-right">Paid</th><th className="text-right">Balance</th>
            <th className="pl-3">Status</th><th></th></tr></thead>
          <tbody>
            {shown.map((r) => {
              const i = invByStudent.get(r.id);
              const bal = i ? i.total - i.paid : 0;
              const late = i && i.status !== "paid" && i.dueDate && i.dueDate < today;
              return (
                <tr key={r.id} className="border-t border-border">
                  <td className="py-2 font-medium">{r.lastName}, {r.firstName}</td>
                  <td className="text-right">{i ? (i.total / 100).toFixed(2) : "—"}</td>
                  <td className="text-right text-success">{i ? (i.paid / 100).toFixed(2) : ""}</td>
                  <td className={`text-right font-semibold ${bal > 0 ? "text-danger" : ""}`}>{i ? (bal / 100).toFixed(2) : ""}</td>
                  <td className="pl-3">
                    {i
                      ? late ? <Badge tone="danger">overdue</Badge>
                        : i.status === "paid" ? <Badge tone="success">paid ✓</Badge>
                          : i.status === "part_paid" ? <Badge tone="warning">part-paid</Badge>
                            : <Badge tone="default">unpaid</Badge>
                      : <span className="text-[12px] text-muted-foreground">no bill</span>}
                  </td>
                  <td className="py-1.5 text-right">
                    {i && (
                      <span className="inline-flex gap-1.5">
                        <Link href={`/fees/invoice/${i.id}`} className={btnGhostCls + " px-2.5 py-1 text-[12.5px]"}>Open</Link>
                        <a href={`/api/fees/pdf/invoice/${i.id}`} target="_blank"
                          className={btnGhostCls + " px-2.5 py-1 text-[12.5px]"}>PDF</a>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!shown.length && (
              <tr><td colSpan={6} className="py-3 text-muted-foreground">Nothing here — try another class or filter.</td></tr>
            )}
          </tbody>
        </table></div>
      </Card>

      <Card className="mt-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Day-close · today</h2>
          <span className="text-[12.5px] text-muted-foreground" data-nums="">{live.length} receipts · {ghs(todayTotal)}</span>
        </div>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Who collected what — the drawer count, by name. Voided receipts are excluded.
        </p>
        {byCashier.size ? (
          <div className="overflow-x-auto"><table className="min-w-[460px] mt-2 w-full text-sm" data-nums="">
            <thead><tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="py-1">Cashier</th><th className="text-right">Cash</th>
              <th className="text-right">MoMo / bank</th><th className="text-right">Receipts</th></tr></thead>
            <tbody>
              {[...byCashier.entries()].map(([id, row]) => (
                <tr key={id} className="border-t border-border">
                  <td className="py-1.5 font-medium">{cashierNames.get(id) ?? "School office"}</td>
                  <td className="text-right">{(row.cash / 100).toFixed(2)}</td>
                  <td className="text-right">{(row.other / 100).toFixed(2)}</td>
                  <td className="text-right">{row.n}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        ) : <p className="mt-2 text-sm text-muted-foreground">No payments recorded today yet.</p>}
      </Card>

      {canGenerate && Number(t.n) > 0 && (
        <p className="mt-5 flex items-center gap-2 text-[12.5px] text-muted-foreground">
          <Settings2 size={13} />
          Students without a bill (new admissions) get one on the next run:
        </p>
      )}
      {canGenerate && Number(t.n) > 0 && (
        <form action={generateInvoices.bind(null, slug)} className="mt-1.5">
          <SubmitButton className={btnGhostCls} pendingText="Generating…">
            Generate missing {term.name} invoices
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
