import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, like } from "drizzle-orm";
import { db } from "@/db";
import { smsLog } from "@/db/schema";
import { requireModule } from "@/core/school-context";
import { assertParentOf } from "@/core/portal";
import { canFeeAction } from "@/core/access";
import { loadReceiptDoc, amountInWords } from "@/modules/fees/docs";
import { payingGuardian } from "@/modules/fees/engine";
import { ghs } from "@/modules/fees/config";
import { voidPayment } from "../../actions";
import { PrintButton } from "@/ui/print-button";
import { SignLine, StampSlot } from "@/ui/paper-sign";
import { Badge, btnCls, btnGhostCls } from "@/ui/kit";
import { ConfirmButton } from "@/ui/confirm";

const big = btnGhostCls + " h-11 text-[14.5px]";

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
  // was the parent texted this receipt? (logged as kind "receipt", body carries the number)
  const [sms, guardian] = isAdmin ? await Promise.all([
    db.select({ status: smsLog.status }).from(smsLog).where(and(
      eq(smsLog.schoolId, school.id), eq(smsLog.kind, "receipt"),
      like(smsLog.body, `%Receipt ${p.receiptNo ?? "∅"}.%`))).limit(1),
    payingGuardian(d.student.id),
  ]) : [[], null];
  const texted = sms.length > 0;

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={isAdmin ? "/fees" : `/fees?child=${d.student.id}`}
          className="inline-flex h-11 items-center text-[14.5px] font-medium text-primary">← Fees</Link>
        <div className="flex flex-wrap items-center gap-2">
          <a href={`/api/fees/pdf/receipt/${p.id}`} target="_blank" className={big}>Download PDF</a>
          {canVoid && !p.voidedAt && (
            <form action={voidPayment.bind(null, slug, p.id)}>
              <ConfirmButton danger title={`Void receipt ${p.receiptNo ?? ""}?`}
                body={`${ghs(p.amountPesewas)} goes back onto ${d.student.firstName}'s balance. The receipt keeps its number and shows VOID.`}
                confirmLabel="Void it"
                className="inline-flex h-11 items-center rounded-full border border-danger/40 px-4 text-[14.5px] font-medium text-danger hover:bg-danger/10">
                Void this receipt
              </ConfirmButton>
            </form>
          )}
          {p.voidedAt && <Badge tone="danger">VOID</Badge>}
        </div>
      </div>

      {isAdmin && !p.voidedAt && (
        <div className="mb-4 rounded-lg bg-success-soft px-4 py-3 text-[15px] text-success print:hidden">
          <p className="font-semibold" data-nums="">Payment of {ghs(p.amountPesewas)} saved.</p>
          <p className="mt-0.5 text-[14px]">
            {guardian
              ? texted ? `Receipt SMS sent to ${guardian.name}.` : `No receipt SMS went to ${guardian.name} for this one.`
              : "No phone on file for this child's parent, so no receipt SMS."}
          </p>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-2 print:hidden sm:flex-row">
        <PrintButton className={btnCls + " h-12 flex-1 text-[16px]"} label="Print receipt" />
        {isAdmin && <Link href="/fees" className={btnGhostCls + " h-12 flex-1 text-[15px]"}>Record another payment</Link>}
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
          Thank you. Keep this receipt — it is your proof of payment. · SchoolSpec
        </p>
      </div>
    </div>
  );
}
