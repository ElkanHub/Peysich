import { db } from "@/db";
import { outbox } from "@/db/schema";
import { uid } from "./utils";

/** Outbound messaging, always graceful: no key → email no-ops, SMS logs as
 *  "queued" with cost tracked (re-billable). Keys (HANDOFF.md §6–7) flip both live. */

export async function sendEmail(
  to: string, subject: string, html: string, fromName = "SchoolSpec",
  attachments?: { filename: string; content: Buffer }[],
) {
  if (!process.env.RESEND_API_KEY) return { sent: false as const };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${fromName} <${process.env.EMAIL_FROM ?? "noreply@send.schoolspec.com"}>`,
      to, subject, html,
      attachments: attachments?.map((a) => ({ filename: a.filename, content: a.content.toString("base64") })),
    }),
  });
  return { sent: res.ok };
}

/** @deprecated Thin shim over src/messaging/notify.ts (kind "custom"): the
 *  text goes as given, priced and charged to the wallet like everything else.
 *  New code calls notify() with a real kind. Returns the old status string. */
export async function sendSms(opts: {
  schoolId: string; to: string; body: string; kind: string; senderId?: string;
}) {
  const { notify } = await import("@/messaging/notify");
  const r = await notify({
    school: { id: opts.schoolId, name: "" }, to: { kind: "phone", phone: opts.to },
    kind: "custom", vars: { text: opts.body }, senderId: opts.senderId, logKind: opts.kind,
  });
  return r.status;
}

export async function sendSmsBatch(rows: Parameters<typeof sendSms>[0][]) {
  for (const r of rows) await sendSms(r);
}

/** Email blast to guardians — branded with the SCHOOL's name so a parent
 *  always knows which school is writing, sent via the platform address.
 *  Logged in the outbox like every send, so the school sees what went out. */
export async function sendEmailBlast(rows: {
  schoolId: string; to: string; schoolName: string; subject: string; body: string;
}[]) {
  for (const r of rows) {
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
        <h2 style="margin:0 0 4px">${r.schoolName}</h2>
        <p style="margin:0 0 16px;color:#6b7280;font-size:13px">A message from your school</p>
        <div style="border:1px solid #e6e8ec;border-radius:10px;padding:16px;font-size:15px;line-height:1.6">
          ${r.body.replace(/\n/g, "<br/>")}
        </div>
        <p style="margin-top:16px;color:#9aa1ab;font-size:12px">
          Sent by ${r.schoolName} via SchoolSpec. If this doesn't concern your child's school, please ignore it.
        </p>
      </div>`;
    const { sent } = await sendEmail(r.to, r.subject, html, r.schoolName);
    await db.insert(outbox).values({
      id: uid(), schoolId: r.schoolId, to: r.to, body: r.body, channel: "email",
      kind: "email-blast", status: sent ? "sent" : "failed", sentAt: sent ? new Date() : null,
    });
  }
}
