"use client";
import { useState } from "react";
import { Field, inputCls, btnCls } from "@/ui/kit";
import { ConfirmButton } from "@/ui/confirm";
import { SMS_COST_PESEWAS, smsSegments, withSignature } from "./sms";

/** "Text every parent": the box, a live character + SMS count underneath,
 *  and a confirm that carries the real numbers before money leaves. */
export function BlastForm({ action, schoolName, phones, emails }: {
  action: (f: FormData) => void | Promise<void>; schoolName: string; phones: number; emails: number;
}) {
  const [body, setBody] = useState("");
  const [viaSms, setViaSms] = useState(true);
  const [viaEmail, setViaEmail] = useState(false);
  const chars = withSignature(body, schoolName).length;
  const k = smsSegments(withSignature(body, schoolName));
  const cost = (phones * k * SMS_COST_PESEWAS) / 100;
  const ghs = cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const title = viaSms
    ? `Send to ${phones} parents as ${k} SMS each (about GHS ${ghs})?`
    : `Email ${emails} parents?`;
  const detail = [
    viaSms && `${phones} parents have a phone number.`,
    viaEmail && `${emails} parents have an email.`,
    "There is no un-send.",
  ].filter(Boolean).join(" ");

  return (
    <form action={action} className="mt-3 space-y-2.5">
      <Field label="Text message">
        <textarea name="body" rows={4} maxLength={300} required className={inputCls}
          value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>
      <p className="text-[14px] text-muted-foreground" data-nums="">
        {chars} characters · {k} SMS each
        <span className="block text-[13px]">Counted with the “ — {schoolName}” signature every text ends with.</span>
      </p>
      <div className="flex gap-4 text-[15px]">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" name="viaSms" checked={viaSms} onChange={(e) => setViaSms(e.target.checked)} /> SMS
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" name="viaEmail" checked={viaEmail} onChange={(e) => setViaEmail(e.target.checked)} /> Email
        </label>
      </div>
      <ConfirmButton className={btnCls + " h-11 w-full text-[15px]"} title={title} body={detail}
        confirmLabel="Send" disabled={!body.trim() || (!viaSms && !viaEmail)}>
        Send
      </ConfirmButton>
    </form>
  );
}
