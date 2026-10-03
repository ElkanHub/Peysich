"use client";
import { useState } from "react";
import { Field, inputCls, btnCls } from "@/ui/kit";
import { ConfirmButton } from "@/ui/confirm";
import { linkUrl, render, titleOf } from "@/messaging/render";
import type { ParentReach } from "@/messaging/messages";
import { smsSegments, withSignature } from "./sms";

const ghs = (p: number) => `GHS ${(p / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "Message every parent": the box, a live count underneath, and a confirm
 *  that carries the real numbers — who gets it how, the cost and the balance
 *  after — before money leaves. The text itself lives in the app; the ping
 *  carries its first line and a link. Phone-only parents get the whole text. */
export function BlastForm({ action, schoolName, reach, emails }: {
  action: (f: FormData) => void | Promise<void>; schoolName: string; reach: ParentReach; emails: number;
}) {
  const [body, setBody] = useState("");
  const [viaSms, setViaSms] = useState(true);
  const [viaEmail, setViaEmail] = useState(false);
  // the same two texts notify() sends: the ping with a link, and the whole text
  const ping = render("announcement_ping", { school: schoolName, title: titleOf(body), link: linkUrl("x".repeat(12)) });
  const full = withSignature(body, schoolName);
  const sms = reach.smsPing + reach.smsFull;
  const people = reach.whatsapp + sms + reach.free;
  const cost = reach.whatsapp * reach.whatsappPrice
    + (reach.smsPing * smsSegments(ping) + reach.smsFull * smsSegments(full)) * reach.smsPrice;
  const enough = reach.balance >= cost;
  const split = [reach.whatsapp && `${reach.whatsapp} by WhatsApp`, sms && `${sms} by SMS`,
    reach.free && `${reach.free} in the app or on Telegram only`].filter(Boolean).join(" and ");
  const title = viaSms ? `Send to ${people} parents?` : `Email ${emails} parents?`;
  const money = enough ? `Cost ${ghs(cost)}. Balance after ${ghs(reach.balance - cost)}.`
    : `Not enough balance. This will reach the app and Telegram for free; top up GHS ${Math.max(20, Math.ceil((cost - reach.balance) / 100))} to send the pings.`;
  const detail = [
    viaSms && `${split || "Nobody has a phone number yet"}. ${money}`,
    viaSms && reach.smsFull > 0 && `${reach.smsFull} parents without a smartphone get the whole text by SMS; the others get its first line and a link to read it.`,
    viaEmail && `${emails} parents have an email.`,
    "There is no un-send.",
  ].filter(Boolean).join(" ");

  return (
    <form action={action} className="mt-3 space-y-2.5">
      <Field label="Message">
        <textarea name="body" rows={4} maxLength={1000} required className={inputCls}
          value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>
      <p className="text-[14px] text-muted-foreground" data-nums="">
        {people} parents · {ghs(cost)} for all
        <span className="block text-[13px]">The first line is what the ping shows. Parents tap the link to read the rest.</span>
      </p>
      <div className="flex gap-4 text-[15px]">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" name="viaSms" checked={viaSms} onChange={(e) => setViaSms(e.target.checked)} /> WhatsApp or SMS
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
