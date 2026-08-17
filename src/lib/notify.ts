import { db } from "@/db";
import { smsLog } from "@/db/schema";
import { uid } from "./utils";

/** Outbound messaging, always graceful: no key → email no-ops, SMS logs as
 *  "queued" with cost tracked (re-billable). Keys (HANDOFF.md §6–7) flip both live. */

export async function sendEmail(to: string, subject: string, html: string, fromName = "Peysich") {
  if (!process.env.RESEND_API_KEY) return { sent: false as const };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${fromName} <${process.env.EMAIL_FROM ?? "noreply@peysich.com"}>`,
      to, subject, html,
    }),
  });
  return { sent: res.ok };
}

/** Sends one SMS (Arkesel v2) and logs it; sender ID = school brand where set. */
export async function sendSms(opts: {
  schoolId: string; to: string; body: string; kind: string; senderId?: string;
}) {
  let status = "queued";
  if (process.env.SMS_API_KEY) {
    try {
      const res = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
        method: "POST",
        headers: { "api-key": process.env.SMS_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: (opts.senderId ?? "Peysich").slice(0, 11),
          message: opts.body, recipients: [opts.to],
        }),
      });
      status = res.ok ? "sent" : "failed";
    } catch { status = "failed"; }
  }
  await db.insert(smsLog).values({
    id: uid(), schoolId: opts.schoolId, to: opts.to, body: opts.body, kind: opts.kind, status,
  });
  return status;
}

export async function sendSmsBatch(rows: Parameters<typeof sendSms>[0][]) {
  for (const r of rows) await sendSms(r);
}
