import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { contactChannels, guardians, schools, staff } from "@/db/schema";
import { opsAlert } from "@/messaging/outbox";
import { readLinkPayload, sendTelegram, webhookSecret, type Bot } from "@/messaging/providers/telegram";
import { getSettings, setSetting } from "@/messaging/settings";

/** Telegram calls here for both bots (?bot=school|ops). The secret header is
 *  the one given to setWebhook, so only Telegram can post. */
export async function POST(req: NextRequest) {
  const bot: Bot = req.nextUrl.searchParams.get("bot") === "ops" ? "ops" : "school";
  if (req.headers.get("x-telegram-bot-api-secret-token") !== webhookSecret(bot))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const msg = ((await req.json()) as { message?: { chat: { id: number }; text?: string; from?: { first_name?: string } } }).message;
  if (!msg) return NextResponse.json({ ok: true });
  const chatId = String(msg.chat.id);
  const text = (msg.text ?? "").trim();
  const say = (t: string) => sendTelegram({ bot, chatId, text: t }).catch(() => {});

  if (bot === "ops") {
    // the first /start claims the alerts; later ones from other chats are ignored
    const { ops_chat_id } = await getSettings();
    if (text.startsWith("/start") && !ops_chat_id) {
      await setSetting("ops_chat_id", chatId);
      await say("This chat now gets SchoolSpec alerts.");
    } else if (ops_chat_id !== chatId) await say("This bot is private.");
    return NextResponse.json({ ok: true });
  }

  const link = text.startsWith("/start ") ? readLinkPayload(text.slice(7).trim()) : null;
  if (link) {
    const table = link.kind === "guardian" ? guardians : staff;
    const [who] = await db.select({ id: table.id, schoolId: table.schoolId }).from(table)
      .where(sql`replace(${table.id}, '-', '') = ${link.idNoDashes}`);
    if (!who) { await say("That link is no longer valid. Ask the school for a new one."); return NextResponse.json({ ok: true }); }
    await db.insert(contactChannels)
      .values({ ownerKind: link.kind, ownerId: who.id, schoolId: who.schoolId, telegramChatId: chatId, linkedAt: new Date() })
      .onConflictDoUpdate({
        target: [contactChannels.ownerKind, contactChannels.ownerId],
        set: { telegramChatId: chatId, linkedAt: new Date() },
      });
    const [school] = await db.select({ name: schools.name }).from(schools).where(eq(schools.id, who.schoolId));
    await say(`Linked. You will now get ${school?.name ?? "your school"}'s messages here, free.`);
    return NextResponse.json({ ok: true });
  }

  // anything else is a reply: answer with the office number, forward to the operator
  const [mine] = await db.select({ name: schools.name, branding: schools.branding }).from(contactChannels)
    .innerJoin(schools, eq(contactChannels.schoolId, schools.id)).where(eq(contactChannels.telegramChatId, chatId)).limit(1);
  await say(mine
    ? `This chat only sends messages for ${mine.name}. ${mine.branding.phone ? `To reach the school, call ${mine.branding.phone}.` : "To reach the school, please call the office."}`
    : "To get your school's messages here, open the Telegram link in SchoolSpec under My Account.");
  if (mine && text) await opsAlert(`Telegram reply (${mine.name}) from ${msg.from?.first_name ?? chatId}: ${text.slice(0, 500)}`);
  return NextResponse.json({ ok: true });
}
