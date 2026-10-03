import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { outbox, schools } from "@/db/schema";
import { opsAlert, providerStatus } from "@/messaging/outbox";
import { sendWhatsAppText, validWhatsAppSignature } from "@/messaging/providers/whatsapp";
import { getSettings } from "@/messaging/settings";

/** Meta's one-time check when the webhook is saved (MESSAGING_SETUP.md §5.5). */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const ok = q.get("hub.mode") === "subscribe" && !!process.env.WHATSAPP_VERIFY_TOKEN
    && q.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN;
  return ok ? new NextResponse(q.get("hub.challenge")) : NextResponse.json({ error: "forbidden" }, { status: 403 });
}

type Value = {
  statuses?: { id: string; status: string; errors?: { title?: string }[] }[];
  messages?: { from: string; type: string; text?: { body: string } }[];
};

/** Delivery receipts move the outbox row on; a reply to the shared number is
 *  answered with the school's office number and forwarded to the operator. */
export async function POST(req: NextRequest) {
  const body = await req.text();
  if (!validWhatsAppSignature(body, req.headers.get("x-hub-signature-256")))
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  const evt = JSON.parse(body) as { entry?: { changes?: { value?: Value }[] }[] };
  for (const value of (evt.entry ?? []).flatMap((e) => e.changes ?? []).map((c) => c.value ?? {})) {
    for (const s of value.statuses ?? []) {
      if (s.status === "delivered" || s.status === "read" || s.status === "failed")
        await providerStatus(s.id, s.status, s.errors?.[0]?.title);
    }
    for (const m of value.messages ?? []) await answerReply(m.from, m.text?.body ?? `(${m.type})`);
  }
  return NextResponse.json({ ok: true });
}

async function answerReply(from: string, text: string) {
  // whose message are they replying to? the last WhatsApp we sent that number
  const [last] = await db.select({ schoolId: outbox.schoolId, plane: outbox.plane }).from(outbox)
    .where(and(eq(outbox.channel, "whatsapp"), eq(outbox.to, from))).orderBy(desc(outbox.createdAt)).limit(1);
  const [school] = last?.schoolId ? await db.select().from(schools).where(eq(schools.id, last.schoolId)) : [];
  const s = await getSettings();
  const platform = !school || last?.plane === "platform";
  const answer = platform
    ? `This number only sends messages from SchoolSpec.${s.ops_phone ? ` To talk to us, call ${s.ops_phone}.` : ""}`
    : `This number only sends messages for ${school.name}. ${school.branding.phone ? `To reach the school, call ${school.branding.phone}.` : "To reach the school, please call the office."}`;
  const phoneNumberId = platform ? s.wa_number_platform : s.wa_number_school;
  if (phoneNumberId) await sendWhatsAppText({ phoneNumberId, to: from, text: answer }).catch(() => {});
  await opsAlert(`WhatsApp reply from ${from}${school ? ` (${school.name})` : ""}: ${text.slice(0, 500)}`);
}
