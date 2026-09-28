import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { feePayments, smsLog } from "@/db/schema";
import { requireModule } from "@/core/school-context";
import { assertParentOf } from "@/core/portal";
import { canFeeAction } from "@/core/access";
import { loadInvoiceDoc, guardianEmailsFor } from "@/modules/fees/docs";
import { ghs } from "@/modules/fees/config";
import { PaymentForm } from "@/modules/fees/payment-form";
import { emailInvoice, recordPayment } from "../../actions";
import { PrintButton } from "@/ui/print-button";
import { Card, Badge, btnGhostCls } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";

const big = btnGhostCls + " h-11 text-[14.5px]";

/** The invoice paper: what prints for a walk-in parent, what the PDF holds,
 *  what the email attaches — one document, three doors. For the cashier the
 *  payment form sits first: the search on /fees lands here to save a payment. */
export default async function InvoicePage({ params }: {
  params: Promise<{ school: string; id: string }>;
}) {
  const { school: slug, id } = await params;
  const { school, user } = await requireModule(slug, "fees");
  const d = await loadInvoiceDoc(school, id);
  if (!d) notFound();
  const isAdmin = ["admin", "platform_admin"].includes(user.role);
  if (!isAdmin && !(await assertParentOf(school.id, user.id, d.student.id))) notFound();
  const canRecord = isAdmin && await canFeeAction(school.id, user.id, user.role, "record");
  const owing = Math.max(0, d.invoice.totalPesewas - d.invoice.paidPesewas);
  const color = d.school.branding.primaryColor || "#5E1D3E";
  const b = d.school.branding;

  const [pays, emailed, gEmails] = await Promise.all([
    db.select().from(feePayments).where(eq(feePayments.invoiceId, d.invoice.id))
      .orderBy(desc(feePayments.createdAt)),
    db.select().from(smsLog).where(and(
      eq(smsLog.schoolId, school.id), eq(smsLog.kind, "invoice-email")))
      .orderBy(desc(smsLog.createdAt)).limit(50),
    isAdmin ? guardianEmailsFor(school.id, d.student.id) : Promise.resolve([]),
  ]);
  const lastEmailed = emailed.find((e) => e.body.includes(d.invoice.invoiceNo ?? "∅"));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/fees" className="inline-flex h-11 items-center text-[14.5px] font-medium text-primary">← Fees</Link>
        <div className="flex flex-wrap items-center gap-2">
          <PrintButton className={big} />
          <a href={`/api/fees/pdf/invoice/${d.invoice.id}`} target="_blank" className={big}>Download PDF</a>
          {isAdmin && (
            <form action={emailInvoice.bind(null, slug, d.invoice.id)}>
              <SubmitButton className={big} pendingText="Emailing…">Email to guardian{gEmails.length > 1 ? "s" : ""}</SubmitButton>
            </form>
          )}
          {lastEmailed && <Badge tone="success">emailed {lastEmailed.createdAt.toISOString().slice(5, 10)} ✓</Badge>}
        </div>
      </div>

      {/* ── the cashier's job comes first: save the payment ── */}
      {isAdmin && (
        <Card className="mb-5 print:hidden">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {d.student.firstName} {d.student.lastName} · {d.className ?? "—"} · {d.termName}
          </p>
          <h2 className="mt-1 text-[22px] font-bold" data-nums="">
            {owing ? <>Owes <span className="text-danger">{ghs(owing)}</span></> : <span className="text-success">Fully paid ✓</span>}
          </h2>
          {canRecord ? (
            owing > 0 || pays.length === 0 ? (
              <PaymentForm action={recordPayment.bind(null, slug, d.invoice.id)}
                owingGhs={owing ? (owing / 100).toFixed(2) : ""} />
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Nothing left to pay on this bill. Any extra would sit as credit on the child&apos;s balance.</p>
            )
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Your access doesn&apos;t include recording payments — ask a full admin under Settings → Team &amp; access.
            </p>
          )}
          {canRecord && owing > 0 && (
            <p className="mt-2 text-[12.5px] text-muted-foreground">
              Paying more than the balance becomes credit on the child&apos;s balance. A wrong entry is voided from its receipt, never deleted.
            </p>
          )}
        </Card>
      )}

      {/* ── the paper ── */}
      <div className="bg-white p-8 text-black shadow-[var(--shadow-lg)] print:p-0 print:shadow-none">
        <div className="relative border-b-4 pb-3" style={{ borderColor: color }}>
          <div className="flex items-start gap-4">
            {d.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.logoUrl} alt="" className="h-14 w-14 object-contain" />
            )}
            <div>
              <p className="text-[21px] font-bold leading-tight" style={{ color }}>{d.school.name}</p>
              {b.motto && <p className="text-[12px] italic text-neutral-600">{b.motto}</p>}
              <p className="text-[11px] text-neutral-500">{[b.address, b.phone, b.email].filter(Boolean).join(" · ")}</p>
            </div>
            {d.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.photoUrl} alt="" className="ml-auto h-[72px] w-[62px] rounded border border-neutral-300 object-cover" />
            )}
          </div>
        </div>
        <p className="mt-4 text-center text-[14px] font-bold uppercase tracking-[0.12em]">
          Fee Invoice — {d.termName}, {d.yearName}
        </p>
        <div className="mt-2 flex flex-wrap justify-between gap-2 text-[12.5px]" data-nums="">
          <span><b>Invoice No:</b> {d.invoice.invoiceNo ?? "—"}</span>
          <span><b>Issued:</b> {d.invoice.createdAt.toISOString().slice(0, 10)}</span>
          <span><b>Due:</b> {d.invoice.dueDate ?? "—"}</span>
        </div>
        <div className="mt-1 flex flex-wrap justify-between gap-2 text-[12.5px]">
          <span><b>Student:</b> {d.student.firstName} {d.student.lastName}</span>
          <span><b>Class:</b> {d.className ?? "—"}</span>
          <span data-nums=""><b>Admission No:</b> {d.student.admissionNo}</span>
        </div>
        <table className="mt-3 w-full border-collapse text-[13px]" data-nums="">
          <thead>
            <tr>
              <th className="border border-neutral-300 px-2.5 py-1.5 text-left text-[11px] uppercase tracking-wide" style={{ background: `${color}14`, color }}>Item</th>
              <th className="border border-neutral-300 px-2.5 py-1.5 text-right text-[11px] uppercase tracking-wide" style={{ background: `${color}14`, color }}>Amount (GHS)</th>
            </tr>
          </thead>
          <tbody>
            {d.lines.map((l) => (
              <tr key={l.id}>
                <td className="border border-neutral-200 px-2.5 py-1.5">
                  {l.label}
                  {l.source === "carry_forward" && <span className="ml-1.5 text-[10.5px] text-neutral-500">(brought forward from last term)</span>}
                  {l.source === "scholarship" && <span className="ml-1.5 text-[10.5px] text-neutral-500">(discount)</span>}
                </td>
                <td className="border border-neutral-200 px-2.5 py-1.5 text-right">{(l.amountPesewas / 100).toFixed(2)}</td>
              </tr>
            ))}
            <tr className="font-bold" style={{ background: "#faf6f9" }}>
              <td className="border border-neutral-300 px-2.5 py-1.5">Total</td>
              <td className="border border-neutral-300 px-2.5 py-1.5 text-right">{(d.invoice.totalPesewas / 100).toFixed(2)}</td>
            </tr>
            <tr>
              <td className="border border-neutral-200 px-2.5 py-1.5">Paid to date</td>
              <td className="border border-neutral-200 px-2.5 py-1.5 text-right">{(d.invoice.paidPesewas / 100).toFixed(2)}</td>
            </tr>
            <tr className="font-bold text-white">
              <td className="border px-2.5 py-1.5" style={{ background: color, borderColor: color }}>BALANCE DUE</td>
              <td className="border px-2.5 py-1.5 text-right" style={{ background: color, borderColor: color }}>{(owing / 100).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
        <div className="mt-4 rounded border-[1.5px] border-amber-600 p-3 text-[12px] leading-relaxed">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-amber-700">How to pay</p>
          {d.cfg.channelsText
            ? d.cfg.channelsText.split("\n").filter(Boolean).map((l, i) => <p key={i} data-nums="">{l}</p>)
            : <p>Please pay at the school office.</p>}
          <p className="mt-1.5 font-semibold" data-nums="">
            ⚠ Confirm before sending: verify any payment number with the school
            {d.cfg.confirmPhone ? ` on ${d.cfg.confirmPhone}` : ""} before you transfer.
            The school never changes its numbers by SMS.
          </p>
        </div>
        <p className="mt-4 border-t border-neutral-200 pt-2 text-center text-[10px] text-neutral-400">
          Generated for {d.school.name} · SchoolSpec · Issued {d.invoice.createdAt.toISOString().slice(0, 10)}
        </p>
      </div>

      {/* ── payments so far (never printed) ── */}
      {isAdmin && (
        <Card className="mt-5 print:hidden">
          <h2 className="font-semibold">Payments on this bill</h2>
          <ul className="mt-2 divide-y divide-border text-sm" data-nums="">
            {pays.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-1">
                <span className={p.voidedAt ? "line-through opacity-60" : ""}>
                  <b>{p.receiptNo ?? "—"}</b>
                  <span className="ml-2 text-muted-foreground">{p.createdAt.toISOString().slice(0, 10)} · {ghs(p.amountPesewas)} · {p.method}</span>
                </span>
                <Link href={`/fees/receipt/${p.id}`} className="inline-flex h-11 items-center px-1 text-[14px] font-medium text-primary">
                  {p.voidedAt ? "View (void)" : "View receipt"}
                </Link>
              </li>
            ))}
            {!pays.length && <li className="py-1.5 text-muted-foreground">Nothing yet.</li>}
          </ul>
        </Card>
      )}
    </div>
  );
}
