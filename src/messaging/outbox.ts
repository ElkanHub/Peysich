import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { outbox, walletLedger } from "@/db/schema";
import { sendEmail } from "@/lib/notify";
import { pushEnabled, pushToUsers } from "@/lib/push";
import { uid } from "@/lib/utils";
import { arkeselConfigured, sendArkesel } from "./providers/arkesel";
import { sendTelegram, telegramConfigured } from "./providers/telegram";
import { sendWhatsAppTemplate, whatsappConfigured } from "./providers/whatsapp";
import { getSettings, setSetting } from "./settings";
import { smsParts } from "./sms-parts";
import { getPrices } from "./wallet";

/** The background half of the door (docs/MESSAGING_BUILD_PLAN.md §3).
 *  notify() writes outbox rows; this sends them — a few inline right after
 *  the write, the rest by the minute worker (/api/cron/outbox). Three tries
 *  with backoff; a send that fails for good is refunded to the wallet. */

export type OutboxRow = typeof outbox.$inferSelect;

const MAX_ATTEMPTS = 3;
const BACKOFF_MINUTES = [1, 5, 15];
const CLAIM_MINUTES = 10; // a claimed row that never finished is retried after this
const minutes = (n: number) => new Date(Date.now() + n * 60000);

const configured = (r: OutboxRow) =>
  r.channel === "sms" ? arkeselConfigured()
    : r.channel === "whatsapp" ? whatsappConfigured()
      : r.channel === "telegram" ? telegramConfigured(r.meta.bot ?? "school")
        : r.channel === "push" ? pushEnabled
          : !!process.env.RESEND_API_KEY;

async function deliver(r: OutboxRow, s: Awaited<ReturnType<typeof getSettings>>): Promise<{ providerId?: string }> {
  switch (r.channel) {
    case "sms": return sendArkesel({ to: r.to, body: r.body, senderId: r.meta.senderId });
    case "whatsapp": return sendWhatsAppTemplate({
      phoneNumberId: r.plane === "platform" ? s.wa_number_platform : s.wa_number_school,
      to: r.to, template: r.meta.template ?? "", params: r.meta.params ?? [],
    });
    case "telegram": return sendTelegram({ bot: r.meta.bot, chatId: r.to, text: r.body });
    case "push":
      await pushToUsers([r.to], { title: r.meta.title ?? "SchoolSpec", body: r.body, url: r.meta.url });
      return {};
    default: {
      const { sent } = await sendEmail(r.to, r.meta.subject ?? "SchoolSpec", r.meta.html ?? r.body, r.meta.fromName);
      if (!sent) throw new Error("Resend refused the email");
      return {};
    }
  }
}

/** A send that will never arrive: mark it, give the money back, and — for a
 *  WhatsApp that carried one — send the SMS it was standing in for. */
export async function failRow(r: OutboxRow, error: string) {
  await db.update(outbox).set({ status: "failed", error: error.slice(0, 300) }).where(eq(outbox.id, r.id));
  if (r.pricePesewas > 0 && r.schoolId) {
    await db.insert(walletLedger).values({
      id: uid(), schoolId: r.schoolId, kind: "refund", pesewas: r.pricePesewas, reference: `refund_${r.id}`,
      note: r.kind, channel: r.channel, outboxId: r.id,
    }).onConflictDoNothing();
  }
  const fb = r.channel === "whatsapp" ? r.meta.smsFallback : undefined;
  if (!fb || !r.schoolId) return;
  // ponytail: the fallback SMS is charged without re-checking the wallet floor —
  // the refund above has just covered most of it
  const parts = smsParts(fb.body);
  const price = r.plane === "school" ? parts * (await getPrices()).sms.pricePesewas : 0;
  const id = uid();
  await db.insert(outbox).values({
    id, schoolId: r.schoolId, plane: r.plane, messageId: r.messageId, kind: r.kind, channel: "sms",
    to: fb.to, body: fb.body, meta: { senderId: r.meta.senderId }, parts, pricePesewas: price, nextTryAt: new Date(),
  });
  if (price > 0) await db.insert(walletLedger).values({
    id: uid(), schoolId: r.schoolId, kind: "charge", pesewas: -price, reference: id, note: r.kind,
    pricePesewas: price / parts, channel: "sms", outboxId: id,
  });
}

/** Send what is due. `ids` limits it to rows just written (the inline send);
 *  without it this is the worker's sweep. Safe to run concurrently: a row is
 *  claimed by flipping queued → sending before anything leaves. */
export async function drainOutbox(opts: { ids?: string[]; limit?: number } = {}) {
  if (opts.ids && !opts.ids.length) return { sent: 0, failed: 0, waiting: 0 };
  const now = new Date();
  const due = and(inArray(outbox.status, ["queued", "sending"]), lte(outbox.nextTryAt, now));
  const picked = await db.select({ id: outbox.id }).from(outbox)
    .where(opts.ids ? and(due, inArray(outbox.id, opts.ids)) : due)
    .orderBy(outbox.nextTryAt).limit(opts.limit ?? 200);
  if (!picked.length) return { sent: 0, failed: 0, waiting: 0 };
  const rows = await db.update(outbox)
    .set({ status: "sending", attempts: sql`${outbox.attempts} + 1`, nextTryAt: minutes(CLAIM_MINUTES) })
    .where(and(due, inArray(outbox.id, picked.map((p) => p.id)))).returning();

  const settings = await getSettings();
  // Meta's daily limit: distinct WhatsApp recipients since midnight (Accra is UTC)
  const cap = Number(settings.wa_daily_cap) || 250;
  const midnight = new Date(now.toISOString().slice(0, 10));
  const waToday = new Set(rows.some((r) => r.channel === "whatsapp")
    ? (await db.selectDistinct({ to: outbox.to }).from(outbox)
        .where(and(eq(outbox.channel, "whatsapp"), gte(outbox.sentAt, midnight)))).map((x) => x.to)
    : []);
  const wait = (r: OutboxRow, until: Date) => db.update(outbox)
    .set({ status: "queued", attempts: r.attempts - 1, nextTryAt: until }).where(eq(outbox.id, r.id));

  let sent = 0, failed = 0, waiting = 0;
  const one = async (r: OutboxRow) => {
    // no key yet: the row waits (and stays charged) and goes out the moment the key exists
    if (!configured(r)) { waiting++; return wait(r, minutes(60)); }
    if (r.channel === "whatsapp" && !waToday.has(r.to)) {
      if (waToday.size >= cap) { waiting++; return wait(r, new Date(+midnight + 86400000)); }
      waToday.add(r.to);
    }
    try {
      const { providerId } = await deliver(r, settings);
      await db.update(outbox).set({ status: "sent", providerId: providerId ?? null, sentAt: new Date(), error: null })
        .where(eq(outbox.id, r.id));
      sent++;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      if (r.attempts >= MAX_ATTEMPTS) { failed++; return failRow(r, error); }
      waiting++;
      await db.update(outbox)
        .set({ status: "queued", nextTryAt: minutes(BACKOFF_MINUTES[r.attempts - 1] ?? 15), error: error.slice(0, 300) })
        .where(eq(outbox.id, r.id));
    }
  };
  for (let i = 0; i < rows.length; i += 8) await Promise.all(rows.slice(i, i + 8).map(one));
  return { sent, failed, waiting };
}

/** A provider's word on a message it accepted earlier (WhatsApp webhook). */
export async function providerStatus(providerId: string, status: "delivered" | "read" | "failed", error = "") {
  const [r] = await db.select().from(outbox).where(eq(outbox.providerId, providerId));
  if (!r || r.status === "failed") return;
  if (status === "failed") return failRow(r, error || "The provider could not deliver it");
  if (r.status === "read") return; // read never goes back to delivered
  await db.update(outbox).set({ status }).where(eq(outbox.id, r.id));
}

/** Tell the operator, on the ops bot. Never throws; silent until the bot is
 *  set up and you have sent it /start. */
export async function opsAlert(text: string) {
  try {
    if (!telegramConfigured("ops")) return;
    const { ops_chat_id } = await getSettings();
    if (ops_chat_id) await sendTelegram({ bot: "ops", chatId: ops_chat_id, text });
  } catch { /* an alert must never break what it reports on */ }
}

/** Rings once an hour at most when more than 5% of a channel's sends failed. */
export async function checkFailureRate() {
  const since = minutes(-60);
  const rows = await db.select({ channel: outbox.channel, status: outbox.status, n: sql<number>`count(*)` })
    .from(outbox).where(gte(outbox.createdAt, since)).groupBy(outbox.channel, outbox.status);
  const by = new Map<string, { all: number; failed: number }>();
  for (const r of rows) {
    const e = by.get(r.channel) ?? { all: 0, failed: 0 };
    e.all += Number(r.n); if (r.status === "failed") e.failed += Number(r.n);
    by.set(r.channel, e);
  }
  const bad = [...by].filter(([, e]) => e.all >= 20 && e.failed / e.all > 0.05);
  if (!bad.length) return;
  const last = (await getSettings()).failrate_alert_at;
  if (last && +new Date(last) > +since) return;
  await setSetting("failrate_alert_at", new Date().toISOString());
  await opsAlert(`Sends are failing: ${bad.map(([c, e]) => `${c} ${e.failed} of ${e.all}`).join(", ")} in the last hour.`);
}
