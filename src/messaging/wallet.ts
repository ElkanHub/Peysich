import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { outbox, priceSettings, walletLedger } from "@/db/schema";
import { uid } from "@/lib/utils";
import { SMS_COST_PESEWAS } from "@/lib/sms-cost";
import { getSettings } from "./settings";

/** The school's prepaid messaging wallet (docs/MESSAGING_SETUP.md §0).
 *  Balance = SUM(wallet_ledger.pesewas); nothing else holds a balance. */

// The overdraft limit and the starting credit are console settings (./settings.ts).
export const MIN_TOPUP_PESEWAS = 2000;       // GHS 20
export const TOPUP_PRESETS_GHS = [20, 50, 100, 200];
export const LOW_BALANCE_PESEWAS = 2000;     // the banner shows under this

export type Channel = "sms" | "whatsapp" | "telegram" | "push" | "email";
export const CHANNELS: Channel[] = ["sms", "whatsapp", "telegram", "push", "email"];

/** Seed prices. Cost is what the provider charges us, in whole pesewas:
 *  Arkesel is 2.5p per SMS, stored as 3 (integers only; the console shows
 *  the rounded figure, the real invoice comes from Arkesel). */
const DEFAULT_PRICES: Record<Channel, { pricePesewas: number; costPesewas: number }> = {
  sms: { pricePesewas: SMS_COST_PESEWAS, costPesewas: 3 },
  whatsapp: { pricePesewas: 8, costPesewas: 5 },
  telegram: { pricePesewas: 0, costPesewas: 0 },
  push: { pricePesewas: 0, costPesewas: 0 },
  email: { pricePesewas: 0, costPesewas: 0 },
};

export const ghs = (p: number) =>
  `GHS ${(p / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Price per channel; seeds the table from the defaults the first time it is read. */
export async function getPrices(): Promise<Record<Channel, { pricePesewas: number; costPesewas: number }>> {
  let rows = await db.select().from(priceSettings);
  if (!rows.length) {
    await db.insert(priceSettings)
      .values(CHANNELS.map((channel) => ({ channel, ...DEFAULT_PRICES[channel] })))
      .onConflictDoNothing();
    rows = await db.select().from(priceSettings);
  }
  const out = { ...DEFAULT_PRICES };
  for (const r of rows) if (r.channel in out) out[r.channel as Channel] = { pricePesewas: r.pricePesewas, costPesewas: r.costPesewas };
  return out;
}

export async function setPrice(channel: Channel, pricePesewas: number, costPesewas: number) {
  await db.insert(priceSettings).values({ channel, pricePesewas, costPesewas, effectiveFrom: new Date() })
    .onConflictDoUpdate({ target: priceSettings.channel, set: { pricePesewas, costPesewas, effectiveFrom: new Date() } });
}

export async function getBalance(schoolId: string): Promise<number> {
  const [r] = await db.select({ n: sql<number>`coalesce(sum(${walletLedger.pesewas}), 0)` })
    .from(walletLedger).where(eq(walletLedger.schoolId, schoolId));
  return Number(r?.n ?? 0);
}

/** GHS 20 on sign-up. Idempotent by the `start_<schoolId>` reference. */
export async function grantStartingCredit(schoolId: string) {
  const pesewas = Number((await getSettings()).starting_credit_pesewas) || 0;
  if (pesewas <= 0) return;
  await db.insert(walletLedger).values({
    id: uid(), schoolId, kind: "starting_credit", pesewas,
    reference: `start_${schoolId}`, note: "Starting credit",
  }).onConflictDoNothing();
}

/** One-off for schools that existed before the wallet: credit them the first
 *  time their Messaging card renders, only if the ledger is empty. */
export async function ensureStartingCredit(schoolId: string) {
  const [r] = await db.select({ n: sql<number>`count(*)` }).from(walletLedger)
    .where(eq(walletLedger.schoolId, schoolId));
  if (Number(r?.n ?? 0) === 0) await grantStartingCredit(schoolId);
}

/** A Paystack top-up. Idempotent by reference (webhook and callback both call it).
 *  Returns true when this call added the money. */
export async function creditTopUp(schoolId: string, pesewas: number, reference: string) {
  if (!(pesewas > 0)) return false;
  const r = await db.insert(walletLedger).values({
    id: uid(), schoolId, kind: "topup", pesewas, reference, note: "Top-up by Paystack",
  }).onConflictDoNothing().returning({ id: walletLedger.id });
  if (r.length) await (await import("./platform")).onTopUp(schoolId, pesewas); // the receipt, once
  return r.length > 0;
}

export async function addManualCredit(schoolId: string, pesewas: number, note: string, createdBy: string) {
  await db.insert(walletLedger).values({ id: uid(), schoolId, kind: "manual", pesewas, note, createdBy });
}

/** The wallet reference prefix on Paystack: `wal_<pesewas>_<id>` — the amount
 *  rides in the reference so the callback page can credit without a lookup. */
export const topUpReference = (pesewas: number) => `wal_${pesewas}_${uid()}`;
export const topUpAmountFromReference = (ref: string) => {
  const m = /^wal_(\d+)_/.exec(ref);
  return m ? Number(m[1]) : 0;
};

/** What a batch of SMS will cost, and whether the wallet covers it. */
export async function quoteSms(schoolId: string, messages: number, partsEach = 1) {
  const [prices, balance] = await Promise.all([getPrices(), getBalance(schoolId)]);
  const costPesewas = messages * partsEach * prices.sms.pricePesewas;
  return {
    costPesewas, balance, unitPesewas: prices.sms.pricePesewas,
    enough: balance >= costPesewas,
    after: balance - costPesewas,
    shortfallGhs: Math.max(MIN_TOPUP_PESEWAS, costPesewas - balance) / 100,
  };
}

/** The confirm-box sentence for a paid send (SIMPLE_STEPS §0: numbers in the question). */
export function costSentence(q: Awaited<ReturnType<typeof quoteSms>>, reachesApp = false) {
  if (q.enough) return `Cost ${ghs(q.costPesewas)}. Balance after ${ghs(q.after)}.`;
  const need = Math.ceil(q.shortfallGhs);
  return reachesApp
    ? `Not enough balance. This will reach the app for free; top up GHS ${need} to send the SMS.`
    : `Not enough balance (${ghs(q.balance)}). Top up GHS ${need} under Billing to send the SMS.`;
}

/** Usage since a date, for the Messaging card: by channel and by kind.
 *  Held and failed sends are counted apart — nothing left the wallet for them. */
export async function usageSince(schoolId: string, since: Date) {
  const rows = await db.select({
    kind: outbox.kind, channel: outbox.channel, status: outbox.status, n: sql<number>`count(*)`,
    parts: sql<number>`coalesce(sum(${outbox.parts}), 0)`,
    pesewas: sql<number>`coalesce(sum(${outbox.pricePesewas}), 0)`,
  }).from(outbox)
    .where(and(eq(outbox.schoolId, schoolId), eq(outbox.plane, "school"), gte(outbox.createdAt, since)))
    .groupBy(outbox.kind, outbox.channel, outbox.status);
  const channels: Record<Channel, { n: number; pesewas: number }> = {
    sms: { n: 0, pesewas: 0 }, whatsapp: { n: 0, pesewas: 0 }, telegram: { n: 0, pesewas: 0 },
    push: { n: 0, pesewas: 0 }, email: { n: 0, pesewas: 0 },
  };
  const byKind = new Map<string, number>();
  let held = 0;
  for (const r of rows) {
    if (r.status === "held") { held += Number(r.n); continue; }
    if (r.status === "failed" || !(r.channel in channels)) continue;
    const c = channels[r.channel as Channel];
    c.n += r.channel === "sms" ? Number(r.parts) : Number(r.n); // SMS is counted and charged in parts
    c.pesewas += Number(r.pesewas);
    if (r.channel === "sms" || r.channel === "whatsapp") byKind.set(r.kind, (byKind.get(r.kind) ?? 0) + Number(r.n));
  }
  return { channels, held, byKind: [...byKind].sort((a, b) => b[1] - a[1]) };
}

export async function ledgerRows(schoolId: string, limit = 200) {
  return db.select().from(walletLedger).where(eq(walletLedger.schoolId, schoolId))
    .orderBy(desc(walletLedger.createdAt)).limit(limit);
}
