import Link from "next/link";
import { and, eq, sql, inArray, gte } from "drizzle-orm";
import { db } from "@/db";
import {
  feeInvoices, feeInvoiceLines, feePayments, ledgerEntries, students, classes,
  levels, guardians, studentGuardians, user as userTable,
} from "@/db/schema";
import { requireModule, getCurrentTerm } from "@/core/school-context";
import { getParentChildren } from "@/core/portal";
import { canFeeAction } from "@/core/access";
import { getFeesConfig, getRemindersSent, reminderBody, confirmTail, ghs } from "@/modules/fees/config";
import { render } from "@/messaging/render";
import { smsParts } from "@/messaging/sms-parts";
import { costSentence, quoteSms } from "@/messaging/wallet";
import { generateInvoicesForTerm } from "@/modules/fees/engine";
import { HowToPay } from "@/modules/fees/how-to-pay";
import { generateInvoices, sendFeeReminders } from "./actions";
import { Card, PageHeader, Stat, Empty, Badge, Tabs, btnCls, btnGhostCls, inputCls } from "@/ui/kit";
import { ConfirmButton } from "@/ui/confirm";
import { ChildAvatar } from "@/ui/child-avatar";

const big = btnCls + " h-11 text-[14.5px]";
const bigGhost = btnGhostCls + " h-11 text-[14.5px]";
const bigBtn = btnCls + " h-11 text-[14.5px]";

export default async function Fees({ params, searchParams }: {
  params: Promise<{ school: string }>;
  searchParams: Promise<{ q?: string; c?: string; f?: string; child?: string; tab?: string }>;
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
    const statement: (typeof ledger[number] & { balance: number })[] = [];
    for (const e of ledger) {
      const prev = statement.at(-1)?.balance ?? 0;
      statement.push({ ...e, balance: prev + e.debitPesewas - e.creditPesewas });
    }

    return (
      <div className="max-w-3xl">
        <PageHeader title="Fees" sub="Your children's bills, receipts and history — one place, per child" />
        <div className="mb-4 flex flex-wrap gap-2">
          {kids.map((k) => {
            const isActive = k.id === active.id;
            return (
              <Link key={k.id} href={`/fees?child=${k.id}`} aria-current={isActive ? "true" : undefined}
                className={`flex min-h-11 items-center gap-2 rounded-full py-1 pl-1 pr-3.5 text-[14px] font-medium transition-colors ${isActive
                  ? "bg-brand-container text-on-brand-container shadow-[var(--shadow-sm)] ring-2 ring-primary/35 ring-offset-2 ring-offset-background"
                  : "border border-border hover:bg-muted"}`}>
                <ChildAvatar photoUrl={k.photoUrl} initials={`${k.firstName[0]}${k.lastName[0]}`}
                  owing={k.owingPesewas > 0} className="h-8 w-8 text-[11px]" />
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
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {term.year?.name} · {term.name} — {active.firstName} {active.lastName}
          </p>
          {inv ? (
            <>
              <p className={`text-[30px] font-bold tracking-tight ${owing ? "text-danger" : "text-success"}`} data-nums="">
                {owing ? ghs(owing) : "Cleared ✓"}
                {owing > 0 && <span className="ml-2 text-[14px] font-medium text-muted-foreground">to pay</span>}
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
          {inv && (
            <div className="mt-4 flex flex-wrap gap-2">
              {owing > 0 && <a href="#howtopay" className={bigBtn}>How to pay</a>}
              <a href={`/api/fees/pdf/invoice/${inv.id}`} target="_blank" className={bigGhost}>Download bill (PDF)</a>
              <Link href={`/fees/invoice/${inv.id}`} className={bigGhost}>View or print bill</Link>
            </div>
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
                        {l.source === "carry_forward" && <span className="ml-1.5 rounded-full bg-brand-soft px-1.5 py-0.5 text-[10.5px] font-medium text-primary">brought forward from last term</span>}
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
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-1">
                <span className={p.voidedAt ? "line-through opacity-60" : ""}>
                  <b>{p.receiptNo ?? "—"}</b>
                  <span className="ml-2 text-muted-foreground">{p.createdAt.toISOString().slice(0, 10)} · {ghs(p.amountPesewas)} · {p.method}</span>
                  {p.voidedAt && <Badge tone="danger">void</Badge>}
                </span>
                <span className="flex gap-1 text-[14px] font-medium">
                  <Link href={`/fees/receipt/${p.id}`} className="inline-flex h-11 items-center px-2 text-primary">View or print</Link>
                  <a href={`/api/fees/pdf/receipt/${p.id}`} target="_blank" className="inline-flex h-11 items-center px-2 text-primary">Download PDF</a>
                </span>
              </li>
            ))}
            {!pays.length && <li className="py-1.5 text-muted-foreground">Payments the office records show here instantly.</li>}
          </ul>
          <details className="mt-3">
            <summary className="inline-flex min-h-11 cursor-pointer items-center text-[14px] font-medium text-primary">Full statement</summary>
            <div className="overflow-x-auto"><table className="min-w-[520px] mt-2 w-full text-[13px]" data-nums="">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="py-1">Date</th><th>Item</th><th className="text-right">Debit</th><th className="text-right">Credit</th><th className="text-right">Balance</th></tr></thead>
              <tbody>
                {statement.map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-0">
                    <td className="py-1">{e.at.toISOString().slice(0, 10)}</td>
                    <td className="max-w-44 truncate pr-2">{e.memo}</td>
                    <td className="text-right">{e.debitPesewas ? (e.debitPesewas / 100).toFixed(2) : ""}</td>
                    <td className="text-right text-success">{e.creditPesewas ? (e.creditPesewas / 100).toFixed(2) : ""}</td>
                    <td className="text-right font-medium">{(e.balance / 100).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </details>
        </Card>
      </div>
    );
  }

  // ═══ admin: the fees desk — "Who is paying?" first, the books below ═══
  const canGenerate = await canFeeAction(school.id, user.id, user.role, "generate");
  const canCatalog = await canFeeAction(school.id, user.id, user.role, "catalog");
  const [totals, invRows, roster, cls, todayPays, preview] = await Promise.all([
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
    // what "Create bills" would do — the confirm box shows these numbers
    canGenerate ? generateInvoicesForTerm(school, term.id, user.id, { dryRun: true }) : null,
  ]);
  const t = totals[0];
  const nBills = Number(t.n);
  const invByStudent = new Map(invRows.map((i) => [i.studentId, i]));
  const classNameById = new Map(cls.map((c) => [c.id, c.name]));
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
  // today's money: per cashier per method
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

  // "Who is paying?" — a name search over active students (server side, in memory:
  // the roster is already here for the books below)
  const q = (sp.q ?? "").trim().toLowerCase();
  const hits = q
    ? roster.filter((r) => `${r.firstName} ${r.lastName} ${r.lastName} ${r.firstName}`.toLowerCase().includes(q))
        .sort((a, b) => a.lastName.localeCompare(b.lastName)).slice(0, 25)
    : [];

  const tab = ["today", "ledger", "reminders"].includes(sp.tab ?? "") ? sp.tab! : "today";
  const studentById = new Map(roster.map((r) => [r.id, r]));
  const overdueRows = overdue
    .map((i) => ({ i, s: studentById.get(i.studentId) }))
    .filter((x) => x.s)
    .sort((a, b) => (a.i.dueDate! < b.i.dueDate! ? -1 : 1));
  const daysLate = (due: string) => Math.max(1, Math.floor((Date.parse(today) - Date.parse(due)) / 86400000));
  // reminders: who gets texted, what it says, what it costs — before the tap
  const sentToday = (() => { const s = getRemindersSent(school.settings); return s && s.at.toDateString() === new Date().toDateString() ? s : null; })();
  const reminderPhones = tab === "reminders" && overdueRows.length
    ? await db.select({ phone: guardians.phone }).from(studentGuardians)
        .innerJoin(guardians, eq(studentGuardians.guardianId, guardians.id))
        .where(inArray(studentGuardians.studentId, overdueRows.map((x) => x.i.studentId)))
    : [];
  const nParents = reminderPhones.length;
  const sampleOwing = overdueRows[0] ? overdueRows[0].i.total - overdueRows[0].i.paid : 0;
  const reminderText = reminderBody(school.name, cfg, sampleOwing);
  // what the SMS will take from the messaging balance — in the confirm, before the tap
  const reminderQuote = nParents ? await quoteSms(school.id, nParents, smsParts(reminderText)) : null;
  const billQuote = preview && preview.created > 0
    ? await quoteSms(school.id, preview.created, smsParts(render("bill", {
        school: school.name, term: term.name, amount: ghs(preview.totalPesewas), due: today, confirm: confirmTail(cfg) })))
    : null;
  const generateBox = preview && preview.created > 0 && (
    <form action={generateInvoices.bind(null, slug)}>
      <ConfirmButton className={big}
        title={`Create ${term.name} bills?`}
        body={`${preview.created} ${preview.created === 1 ? "child" : "children"}, totalling ${ghs(preview.totalPesewas)}. Each parent gets an SMS. ${billQuote ? costSentence(billQuote) : ""}`}
        confirmLabel="Create bills">
        Create bills{nBills > 0 ? ` for ${preview.created} new ${preview.created === 1 ? "child" : "children"}` : ""}
      </ConfirmButton>
    </form>
  );

  return (
    <div className="max-w-4xl">
      <PageHeader title="Fees"
        sub={`${term.year?.name} · ${term.name} · ${nBills} bill${nBills === 1 ? "" : "s"}`}
        action={canCatalog ? { href: "/fees/setup", label: "Fee amounts & settings" } : undefined} />

      {nBills === 0 && (
        <Card className="mb-5">
          <h2 className="text-[17px] font-semibold">{term.name} bills are not created yet.</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">
            {preview && preview.created === 0
              ? <>Set the fee amounts first{canCatalog && <> (<Link href="/fees/setup" className="font-medium text-primary">Fee amounts &amp; settings</Link>)</>}, then create the bills. Every child gets a bill with last term&apos;s balance brought forward and a due date{cfg.dueWeeks ? ` ${cfg.dueWeeks} weeks into the term` : ""}.</>
              : <>Every child gets a bill with last term&apos;s balance brought forward and a due date{cfg.dueWeeks ? ` ${cfg.dueWeeks} weeks into the term` : ""}.</>}
          </p>
          {!canGenerate && <p className="mt-2 text-[13px] text-muted-foreground">Only a full admin can create bills.</p>}
          {generateBox && <div className="mt-3">{generateBox}</div>}
        </Card>
      )}

      {/* ── who is paying? ── */}
      <Card className="mb-5">
        <form method="get" action="/fees">
          <label htmlFor="who" className="block text-[19px] font-bold">Who is paying?</label>
          <p className="mb-2 text-[14px] text-muted-foreground">Type the child&apos;s name.</p>
          <div className="flex gap-2">
            <input id="who" name="q" defaultValue={sp.q ?? ""} autoFocus autoComplete="off"
              placeholder="e.g. Ama" className={inputCls + " h-12 text-[17px]"} />
            <button type="submit" className={big}>Search</button>
          </div>
        </form>
        {q && (
          <ul className="mt-3 divide-y divide-border">
            {hits.map((r) => {
              const i = invByStudent.get(r.id);
              const bal = i ? i.total - i.paid : 0;
              const inner = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-semibold">{r.firstName} {r.lastName}</span>
                    <span className="text-[13px] text-muted-foreground">{classNameById.get(r.classId ?? "") ?? "No class"}</span>
                  </span>
                  <span className="text-right" data-nums="">
                    {i ? (
                      <>
                        <span className={`block text-[16px] font-bold ${bal > 0 ? "text-danger" : "text-success"}`}>{bal > 0 ? `owes ${ghs(bal)}` : "paid up"}</span>
                        <span className="text-[13px] text-primary">Record payment →</span>
                      </>
                    ) : <span className="text-[13px] text-muted-foreground">No bill this term</span>}
                  </span>
                </>
              );
              return (
                <li key={r.id}>
                  {i ? (
                    <Link href={`/fees/invoice/${i.id}`} className="flex min-h-14 items-center gap-3 py-2 hover:bg-muted/50">{inner}</Link>
                  ) : <div className="flex min-h-14 items-center gap-3 py-2">{inner}</div>}
                </li>
              );
            })}
            {!hits.length && <li className="py-3 text-[14px] text-muted-foreground">No active child called &ldquo;{sp.q}&rdquo;. Check the spelling, or search by surname.</li>}
          </ul>
        )}
      </Card>

      <Tabs active={tab} tabs={[
        { key: "today", label: "Today's money", href: "/fees" },
        { key: "ledger", label: "Who owes what", href: "/fees?tab=ledger" },
        { key: "reminders", label: overdue.length ? `Owing past the due date · ${overdue.length}` : "Owing past the due date", href: "/fees?tab=reminders" },
      ]} />

      {tab === "today" && <>
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Collected this term" value={ghs(Number(t.paid))} tone="success" />
        <Stat label="Still owed" value={ghs(Number(t.billed) - Number(t.paid))}
          tone={Number(t.billed) > Number(t.paid) ? "danger" : "success"} />
        <Stat label="Past the due date" value={String(overdue.length)}
          tone={overdue.length ? "danger" : "success"} />
        <Stat label="Collected today" value={ghs(todayTotal)} />
      </div>

      {overdue.length > 0 && (
        <p className="mb-5 rounded-lg border border-warning/60 bg-warning-soft px-4 py-2.5 text-[14px]">
          <b>{overdue.length}</b> {overdue.length === 1 ? "child is" : "children are"} past the due date —{" "}
          <Link href="/fees?tab=reminders" className="inline-flex min-h-11 items-center font-semibold text-warning underline-offset-2 hover:underline">
            see who, and text their parents
          </Link>.
        </p>
      )}

      <Card>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Today&apos;s money</h2>
          <span className="text-[12.5px] text-muted-foreground" data-nums="">{live.length} receipt{live.length === 1 ? "" : "s"} · {ghs(todayTotal)}</span>
        </div>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Who collected what today, by name. Voided receipts are left out.
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

      {nBills > 0 && generateBox && (
        <div className="mt-5">
          <p className="mb-1.5 text-[13px] text-muted-foreground">
            {preview!.created} {preview!.created === 1 ? "child admitted" : "children admitted"} since the bills were created still {preview!.created === 1 ? "has" : "have"} no bill.
          </p>
          {generateBox}
        </div>
      )}
      </>}

      {tab === "ledger" && <>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {clsOrdered.map((c) => (
          <Link key={c.id} href={`/fees?tab=ledger&c=${c.id}${sp.f ? `&f=${sp.f}` : ""}`}
            className={`inline-flex min-h-11 items-center rounded-full px-3.5 text-[13.5px] font-medium ${c.id === activeCls?.id
              ? "bg-brand-container text-on-brand-container" : "border border-border hover:bg-muted"}`}>
            {c.name}
          </Link>
        ))}
        <Link href={`/fees?tab=ledger&c=${activeCls?.id ?? ""}${sp.f ? "" : "&f=due"}`}
          className={`ml-auto inline-flex min-h-11 items-center rounded-full px-3.5 text-[13.5px] font-medium ${sp.f
            ? "bg-warning text-white" : "border border-border hover:bg-muted"}`}>
          {sp.f ? "Showing only who owes" : "Only who owes"}
        </Link>
      </div>

      <Card>
        <div className="overflow-x-auto"><table className="min-w-[600px] w-full text-sm" data-nums="">
          <thead><tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <th className="py-1.5">Child</th><th className="text-right">Billed</th>
            <th className="text-right">Paid</th><th className="text-right">Owes</th>
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
                      ? late ? <Badge tone="danger">past due</Badge>
                        : i.status === "paid" ? <Badge tone="success">paid ✓</Badge>
                          : i.status === "part_paid" ? <Badge tone="warning">part-paid</Badge>
                            : <Badge tone="default">unpaid</Badge>
                      : <span className="text-[12px] text-muted-foreground">no bill</span>}
                  </td>
                  <td className="py-1 text-right">
                    {i && (
                      <span className="inline-flex gap-1.5">
                        <Link href={`/fees/invoice/${i.id}`} className={bigGhost}>{bal > 0 ? "Record payment" : "Open bill"}</Link>
                        <a href={`/api/fees/pdf/invoice/${i.id}`} target="_blank" className={bigGhost}>PDF</a>
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
      </>}

      {tab === "reminders" && (overdueRows.length ? <>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/60 bg-warning-soft px-4 py-3 text-[14px]">
          <span><b>{overdueRows.length}</b> {overdueRows.length === 1 ? "child is" : "children are"} past the due date.</span>
          <form action={sendFeeReminders.bind(null, slug)}>
            <ConfirmButton className={big + " bg-warning"} disabled={!!sentToday || nParents === 0}
              title={`Text ${nParents} parent${nParents === 1 ? "" : "s"}?`}
              body={<>
                <p>{nParents} SMS. {reminderQuote ? costSentence(reminderQuote) : ""} Each parent gets their own child&apos;s amount. It reads:</p>
                <p className="mt-2 rounded-md bg-muted px-3 py-2 text-[14px] text-foreground">{reminderText}</p>
              </>}
              confirmLabel="Send">
              {sentToday
                ? `Sent at ${sentToday.at.toTimeString().slice(0, 5)} to ${sentToday.n} parent${sentToday.n === 1 ? "" : "s"}`
                : nParents === 0 ? "No parent phone numbers on file" : `Text all ${nParents} parent${nParents === 1 ? "" : "s"}`}
            </ConfirmButton>
          </form>
        </div>
        {sentToday && <p className="mb-4 text-[13px] text-muted-foreground">One reminder a day. The button wakes up tomorrow.</p>}
        <Card>
          <h2 className="font-semibold">Past due, oldest first</h2>
          <div className="mt-2 divide-y divide-border">
            {overdueRows.map(({ i, s }) => (
              <div key={i.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">{s!.lastName}, {s!.firstName}</span>
                  <span className="text-[13px] text-muted-foreground">
                    {classNameById.get(s!.classId ?? "") ?? "—"} · owes <b className="text-danger" data-nums="">{ghs(i.total - i.paid)}</b>
                  </span>
                </span>
                <Badge tone="danger">{daysLate(i.dueDate!)} day{daysLate(i.dueDate!) === 1 ? "" : "s"} late</Badge>
                <Link href={`/fees/invoice/${i.id}`} className={bigGhost}>Record payment</Link>
              </div>
            ))}
          </div>
        </Card>
      </> : (
        <Empty title="Nobody is past the due date"
          hint="When a bill passes its due date the child appears here, one tap from an SMS to the parent. Due dates come from Fee amounts & settings." />
      ))}
    </div>
  );
}
