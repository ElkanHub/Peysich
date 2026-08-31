import Link from "next/link";
import { notFound } from "next/navigation";
import { requireModule } from "@/core/school-context";
import { assertParentOf } from "@/core/portal";
import { canFeeAction } from "@/core/access";
import { loadReceiptDoc, amountInWords } from "@/modules/fees/docs";
import { ghs } from "@/modules/fees/config";
import { voidPayment } from "../../actions";
import { PrintButton } from "@/ui/print-button";
import { SignLine, StampSlot } from "@/ui/paper-sign";
import { Badge, btnGhostCls } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";

/** The official receipt — numbered, branded, with the balance after payment.
 *  Voided receipts keep their number and show the stamp; the sequence never
 *  has holes. */
export default async function ReceiptPage({ params }: {
  params: Promise<{ school: string; id: string }>;
}) {
  const { school: slug, id } = await params;
  const { school, user } = await requireModule(slug, "fees");
  const d = await loadReceiptDoc(school, id);
  if (!d) notFound();
  const isAdmin = ["admin", "platform_admin"].includes(user.role);
  if (!isAdmin && !(await assertParentOf(school.id, user.id, d.student.id))) notFound();
  const canVoid = isAdmin && await canFeeAction(school.id, user.id, user.role, "voidPay");
  const color = d.school.branding.primaryColor || "#5E1D3E";
  const b = d.school.branding;
  const p = d.payment;

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/fees/invoice/${p.invoiceId}`} className="text-[13.5px] font-medium text-primary">← Invoice</Link>
        <div className="flex flex-wrap items-center gap-2">
          <PrintButton />
          <a href={`/api/fees/pdf/receipt/${p.id}`} target="_blank" className={btnGhostCls}>Download PDF</a>
          {canVoid && !p.voidedAt && (
            <form action={voidPayment.bind(null, slug, p.id)}>
              <SubmitButton className="rounded-md border border-danger/40 px-3 py-2 text-sm font-medium text-danger hover:bg-danger/10"
                pendingText="Voiding…">
                Void this receipt
              </SubmitButton>
            </form>
          )}
          {p.voidedAt && <Badge tone="danger">VOID</Badge>}
        </div>
      </div>

      <div className="relative bg-white p-7 text-black shadow-[var(--shadow-lg)] print:p-0 print:shadow-none">
        {p.voidedAt && (
          <p className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 -rotate-12 border-4 border-red-600 px-6 py-2 text-4xl font-black tracking-[0.3em] text-red-600 opacity-40">
            VOID
          </p>
        )}
        <div className="flex items-start gap-3 border-b-4 pb-3" style={{ borderColor: color }}>
          {d.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.logoUrl} alt="" className="h-12 w-12 object-contain" />
          )}
          <div>
            <p className="text-[18px] font-bold leading-tight" style={{ color }}>{d.school.name}</p>
            <p className="text-[10.5px] text-neutral-500">{[b.address, b.phone].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-[12px] font-bold uppercase tracking-[0.12em]">Official Receipt</p>
            <p className="text-[16px] font-bold" style={{ color }} data-nums="">No. {p.receiptNo ?? "—"}</p>
          </div>
        </div>
        <table className="mt-4 w-full text-[13px]" data-nums="">
          <tbody>
            <tr><td className="w-2/5 py-1 font-semibold">Date</td><td>{p.createdAt.toISOString().slice(0, 10)}</td></tr>
            <tr><td className="py-1 font-semibold">For student</td>
              <td>{d.student.firstName} {d.student.lastName} — {d.className ?? "—"} · {d.student.admissionNo}</td></tr>
            <tr><td className="py-1 font-semibold">Amount</td>
              <td className="text-[16px] font-bold">{ghs(p.amountPesewas)}</td></tr>
            <tr><td className="py-1 font-semibold">In words</td><td>{amountInWords(p.amountPesewas)}</td></tr>
            <tr><td className="py-1 font-semibold">Payment for</td><td>{d.termName} fees, {d.yearName}</td></tr>
            <tr><td className="py-1 font-semibold">Method</td>
              <td>{p.method}{p.reference && !p.reference.startsWith("pay_") ? ` · ref ${p.reference}` : ""}{p.note ? ` · ${p.note}` : ""}</td></tr>
            <tr className="border-t border-neutral-300 font-bold">
              <td className="py-1.5">Balance after this payment</td>
              <td className="py-1.5">{ghs(Math.max(0, d.balanceAfter))}</td></tr>
          </tbody>
        </table>
        <div className="mt-7 flex items-end justify-between text-[11px]">
          <div className="w-[42%]"><SignLine label={`Received by — ${d.recordedByName}`} /></div>
          <div className="w-[42%]"><StampSlot url={d.stampUrl} /></div>
        </div>
        <p className="mt-5 border-t border-neutral-200 pt-2 text-center text-[10px] text-neutral-400">
          Thank you. Keep this receipt — it is your proof of payment. · Peysich
        </p>
      </div>
    </div>
  );
}
