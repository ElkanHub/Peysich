"use client";
import { useState, useTransition } from "react";
import { startFeePayment } from "@/app/s/[school]/portal-actions";

/** Parent "Pay" flow: amount (partial allowed) → MoMo checkout. */
export function PayFeesButton({ slug, invoiceId, maxGhs }: {
  slug: string; invoiceId: string; maxGhs: number;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(maxGhs.toFixed(2));
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  if (!open)
    return (
      <button onClick={() => setOpen(true)}
        className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
        Pay
      </button>
    );
  return (
    <span className="flex items-center gap-1">
      <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number"
        min={1} max={maxGhs} step="0.01"
        className="w-24 rounded-md border border-border px-2 py-1 text-xs" />
      <button disabled={pending}
        onClick={() => start(async () => {
          const r = await startFeePayment(slug, invoiceId, Number(amount));
          if (r && "checkoutUrl" in r && r.checkoutUrl) window.location.href = r.checkoutUrl;
          else if (r && "error" in r) setError(r.error ?? "Failed");
        })}
        className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50">
        {pending ? "…" : "Pay now"}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}
