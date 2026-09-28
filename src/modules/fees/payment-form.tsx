"use client";
import { useState } from "react";
import { Field, inputCls, btnCls } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";

/** The cashier's form: amount pre-filled with the balance, Cash chosen,
 *  one big Save. A MoMo or bank payment must carry its reference — the
 *  browser refuses the empty box here and the server refuses it again. */
export function PaymentForm({ action, owingGhs }: {
  action: (f: FormData) => void | Promise<void>; owingGhs: string;
}) {
  const [method, setMethod] = useState("cash");
  const big = inputCls + " h-12 text-[17px]";
  return (
    <form action={action} className="mt-3 grid gap-3 sm:grid-cols-2">
      <Field label="Amount (GHS)">
        <input name="amountGhs" type="number" inputMode="decimal" step="0.01" min="0.01" required
          defaultValue={owingGhs} className={big} data-nums="" />
      </Field>
      <Field label="Paid by">
        <select name="method" value={method} onChange={(e) => setMethod(e.target.value)} className={big}>
          <option value="cash">Cash</option>
          <option value="momo">MoMo</option>
          <option value="bank">Bank transfer</option>
        </select>
      </Field>
      {method !== "cash" && (
        <Field label={method === "momo" ? "MoMo transaction ID (required)" : "Bank reference (required)"}>
          <input name="reference" required autoFocus className={big} />
        </Field>
      )}
      <Field label="Note (optional)">
        <input name="note" placeholder="e.g. paid by uncle" className={big} />
      </Field>
      <SubmitButton className={btnCls + " h-12 text-[16px] sm:col-span-2"} pendingText="Saving…">
        Save payment
      </SubmitButton>
    </form>
  );
}
