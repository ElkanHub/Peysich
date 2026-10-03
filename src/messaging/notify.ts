import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  contactChannels, guardians, messageTemplates, outbox, pushSubscriptions, staff, walletLedger, type OutboxMeta,
} from "@/db/schema";
import { pushEnabled } from "@/lib/push";
import { uid } from "@/lib/utils";
import { drainOutbox, opsAlert } from "./outbox";
import { telegramConfigured } from "./providers/telegram";
import { whatsappConfigured } from "./providers/whatsapp";
import { fill, render, waParams, type Vars } from "./render";
import { getSettings } from "./settings";
import { smsParts } from "./sms-parts";
import { TEMPLATES, isEmergency, urgentByDefault, type MessageKind } from "./templates";
import { getBalance, getPrices, ghs, type Channel } from "./wallet";

/** The one door (docs/MESSAGING_BUILD_PLAN.md §1). Nothing else in the app
 *  sends a message. In order: render the kind's fixed sentence, load how the
 *  person can be reached, route (the app and Telegram always, free; then
 *  WhatsApp if there is a number and consent, else SMS; emergencies both),
 *  price the paid sends against the wallet, write one outbox row per channel,
 *  and say what it did so the toast can. */

export type NotifySchool = { id: string; name: string; branding?: { smsSenderId?: string } };
export type NotifyTo =
  | { kind: "guardian"; id: string }
  | { kind: "staff"; id: string }
  | { kind: "phone"; phone: string }; // a bare number: SMS only

export type NotifyOpts = {
  school: NotifySchool;
  to: NotifyTo;
  kind: MessageKind;
  vars?: Vars;
  link?: string;      // the one-tap link, rendered into {{link}}
  url?: string;       // where the app notification opens
  urgent?: boolean;   // WhatsApp and SMS both, and may overdraw (emergencies already do)
  fullText?: string;  // a phone-only parent gets this by SMS instead of the ping with a link
  messageId?: string; // the `messages` row this ping is for
  senderId?: string;  // override the school's SMS sender name
  logKind?: string;   // override the outbox kind (the sendSms shim uses it)
};

export type NotifyResult = {
  sent: number;   // people a paid ping went to (queued counts: it is charged and on its way)
  held: number;   // people whose paid ping was held: wallet empty
  failed: number;
  free: number;   // people reached by the app or Telegram only
  channels: Record<Channel, number>;
  costPesewas: number;
  /** the paid ping's state after the inline send, for callers that say "sent by SMS" */
  status: "sent" | "queued" | "failed" | "held" | "skipped";
};

/** How one person can be reached. */
export type Recipient = {
  phone: string | null; userId: string | null; phoneOnly: boolean;
  whatsapp: string | null; telegram: string | null; hasPush: boolean;
};
export type RouteEnv = {
  whatsapp: boolean; telegram: boolean; approved: Set<string>;
  smsPrice: number; whatsappPrice: number;
};
export type Planned = {
  channel: Channel; to: string; body: string; parts: number; price: number; meta: OutboxMeta;
};

/** The routing rule, pure: which channels this person gets this message on,
 *  with the text and the price of each. */
export function route(o: Pick<NotifyOpts, "school" | "kind" | "vars" | "link" | "url" | "urgent" | "fullText" | "senderId">,
  r: Recipient, env: RouteEnv): Planned[] {
  const tpl = TEMPLATES[o.kind];
  const vars = { school: o.school.name, link: o.link, ...o.vars };
  // no smartphone: the whole text by SMS, no link to tap
  const full = !!o.fullText && r.phoneOnly;
  const text = full ? render("blast", { text: o.fullText, school: o.school.name }) : render(o.kind, vars);
  // the school's registered sender name; blank falls through to SchoolSpec in the provider
  const senderId = o.senderId || o.school.branding?.smsSenderId || undefined;
  const out: Planned[] = [];
  if (r.userId && r.hasPush)
    out.push({ channel: "push", to: r.userId, body: text.slice(0, 140), parts: 1, price: 0, meta: { title: o.school.name, url: o.url ?? "/" } });
  if (r.telegram && env.telegram)
    out.push({ channel: "telegram", to: r.telegram, body: text, parts: 1, price: 0, meta: {} });

  const sms = (): Planned => {
    const parts = smsParts(text);
    return { channel: "sms", to: r.phone!, body: text, parts, price: parts * env.smsPrice, meta: { senderId } };
  };
  const wa = "wa" in tpl ? tpl.wa as { name: string; text?: string } : null;
  const params = !full && wa && r.whatsapp && env.whatsapp && env.approved.has(wa.name)
    ? waParams(wa.text ?? tpl.sms, vars) : null;
  if (params && wa) {
    const both = !!r.phone && (o.urgent || isEmergency(o.kind));
    out.push({
      channel: "whatsapp", to: r.whatsapp!, body: fill(wa.text ?? tpl.sms, vars), parts: 1, price: env.whatsappPrice,
      meta: { template: wa.name, params, senderId, ...(r.phone && !both ? { smsFallback: { to: r.phone, body: text } } : {}) },
    });
    if (both) out.push(sms());
  } else if (r.phone) out.push(sms());
  return out;
}

export async function routeEnv(): Promise<RouteEnv> {
  const whatsapp = whatsappConfigured();
  const [prices, approved] = await Promise.all([
    getPrices(),
    whatsapp ? db.select({ name: messageTemplates.name }).from(messageTemplates).where(eq(messageTemplates.status, "APPROVED")) : [],
  ]);
  return {
    whatsapp, telegram: telegramConfigured(), approved: new Set(approved.map((a) => a.name)),
    smsPrice: prices.sms.pricePesewas, whatsappPrice: prices.whatsapp.pricePesewas,
  };
}

const key = (to: NotifyTo) => to.kind === "phone" ? `phone:${to.phone}` : `${to.kind}:${to.id}`;

/** Load every recipient of a batch in four queries, whatever its size. */
export async function loadRecipients(schoolId: string, tos: NotifyTo[]): Promise<Map<string, Recipient>> {
  const ids = (k: "guardian" | "staff") => [...new Set(tos.flatMap((t) => t.kind === k ? [t.id] : []))];
  const gIds = ids("guardian"), sIds = ids("staff");
  const [gs, ss, chans] = await Promise.all([
    gIds.length ? db.select({ id: guardians.id, phone: guardians.phone, userId: guardians.userId, pref: guardians.contactPref })
      .from(guardians).where(and(eq(guardians.schoolId, schoolId), inArray(guardians.id, gIds))) : [],
    sIds.length ? db.select({ id: staff.id, phone: staff.phone, userId: staff.userId })
      .from(staff).where(and(eq(staff.schoolId, schoolId), inArray(staff.id, sIds))) : [],
    gIds.length || sIds.length ? db.select().from(contactChannels)
      .where(and(eq(contactChannels.schoolId, schoolId), inArray(contactChannels.ownerId, [...gIds, ...sIds]))) : [],
  ]);
  const userIds = [...gs, ...ss].flatMap((x) => x.userId ? [x.userId] : []);
  const pushers = new Set(pushEnabled && userIds.length
    ? (await db.selectDistinct({ userId: pushSubscriptions.userId }).from(pushSubscriptions)
        .where(inArray(pushSubscriptions.userId, userIds))).map((p) => p.userId)
    : []);
  const chan = new Map(chans.map((c) => [`${c.ownerKind}:${c.ownerId}`, c]));
  const out = new Map<string, Recipient>();
  const add = (k: string, x: { phone: string | null; userId: string | null }, phoneOnly: boolean) => {
    const c = chan.get(k);
    out.set(k, {
      phone: x.phone || null, userId: x.userId, phoneOnly,
      whatsapp: c?.whatsappConsent && c.whatsapp ? c.whatsapp : null,
      telegram: c?.telegramChatId ?? null, hasPush: !!x.userId && pushers.has(x.userId),
    });
  };
  for (const g of gs) add(`guardian:${g.id}`, g, g.pref === "phone");
  for (const s of ss) add(`staff:${s.id}`, s, false);
  for (const t of tos) if (t.kind === "phone" && t.phone)
    out.set(key(t), { phone: t.phone, userId: null, phoneOnly: false, whatsapp: null, telegram: null, hasPush: false });
  return out;
}

const empty = (status: NotifyResult["status"] = "skipped"): NotifyResult => ({
  sent: 0, held: 0, failed: 0, free: 0, costPesewas: 0, status,
  channels: { sms: 0, whatsapp: 0, telegram: 0, push: 0, email: 0 },
});

type Row = Omit<NotifyOpts, "school">;

/** What a batch would do, without doing it: the channel split and the cost
 *  for the confirm box ("153 by WhatsApp and 27 by SMS. Cost GHS 13.86."). */
export async function quoteNotify(school: NotifySchool, rows: Row[]) {
  const [env, people, balance] = await Promise.all([
    routeEnv(), loadRecipients(school.id, rows.map((r) => r.to)), getBalance(school.id),
  ]);
  const q = { whatsapp: 0, sms: 0, free: 0, costPesewas: 0, balance };
  for (const row of rows) {
    const r = people.get(key(row.to));
    const plan = r ? route({ ...row, school }, r, env) : [];
    const paid = plan.filter((p) => p.channel === "sms" || p.channel === "whatsapp");
    for (const p of paid) { q[p.channel as "sms" | "whatsapp"]++; q.costPesewas += p.price; }
    if (!paid.length && plan.length) q.free++;
  }
  return { ...q, enough: balance >= q.costPesewas, after: balance - q.costPesewas };
}

/** The first rows of a batch go out before the action returns, so a single
 *  alert or a login is on the phone at once; a big batch finishes in the
 *  minute worker. */
const INLINE_SENDS = 25;

/** Many recipients, one wallet context, one summed result. */
export async function notifyMany(school: NotifySchool, rows: Row[]): Promise<NotifyResult> {
  const total = empty();
  if (!rows.length) return total;
  const [env, people, balance0, settings] = await Promise.all([
    routeEnv(), loadRecipients(school.id, rows.map((r) => r.to)), getBalance(school.id), getSettings(),
  ]);
  const overdraft = Number(settings.overdraft_pesewas) || 0;
  const started = new Date();
  let balance = balance0;
  const inserts: (typeof outbox.$inferInsert)[] = [];
  const charges: (typeof walletLedger.$inferInsert)[] = [];

  for (const row of rows) {
    const r = people.get(key(row.to));
    if (!r) continue;
    const logKind = row.logKind ?? TEMPLATES[row.kind].log;
    const floor = row.urgent || urgentByDefault(row.kind) ? -overdraft : 0;
    let paid = false, held = false, free = false;
    for (const p of route({ ...row, school }, r, env)) {
      const id = uid();
      const isPaid = p.channel === "sms" || p.channel === "whatsapp";
      const hold = isPaid && balance - p.price < floor;
      inserts.push({
        id, schoolId: school.id, messageId: row.messageId, kind: logKind, channel: p.channel, to: p.to, body: p.body,
        meta: p.meta, parts: p.parts, status: hold ? "held" : "queued", pricePesewas: hold ? 0 : p.price,
        nextTryAt: started, // the app's clock, so the inline send below never loses to the database's
      });
      if (hold) { held = true; continue; }
      if (!isPaid) { free = true; total.channels[p.channel]++; continue; }
      paid = true; total.channels[p.channel]++; total.costPesewas += p.price;
      if (p.price > 0) {
        balance -= p.price;
        charges.push({
          id: uid(), schoolId: school.id, kind: "charge", pesewas: -p.price, reference: id, note: logKind,
          pricePesewas: p.price / p.parts, channel: p.channel, outboxId: id,
        });
      }
    }
    if (paid) total.sent++; else if (held) total.held++;
    if (!paid && free) total.free++;
  }
  if (!inserts.length) return total;
  await db.insert(outbox).values(inserts);
  if (charges.length) await db.insert(walletLedger).values(charges);
  if (balance < 0 && balance0 >= 0) await opsAlert(`${school.name} is using its messaging overdraft: balance ${ghs(balance)}.`);

  const inline = inserts.filter((i) => i.status === "queued").slice(0, INLINE_SENDS).map((i) => i.id);
  const drained = await drainOutbox({ ids: inline });
  total.failed = drained.failed;
  // the state of the paid ping, for single sends that say "sent by SMS"
  const firstPaid = inserts.find((i) => i.channel === "sms" || i.channel === "whatsapp");
  if (firstPaid?.status === "held") total.status = "held";
  else if (firstPaid) {
    const [now] = await db.select({ status: outbox.status }).from(outbox).where(eq(outbox.id, firstPaid.id));
    total.status = now?.status === "sent" ? "sent" : now?.status === "failed" ? "failed" : "queued";
  }
  return total;
}

export async function notify(opts: NotifyOpts): Promise<NotifyResult> {
  const { school, ...row } = opts;
  return notifyMany(school, [row]);
}

/** The toast's tail: who was told, how, and what it cost.
 *  "3 parents told (2 WhatsApp, 1 SMS · GHS 0.22)." */
export function sentSentence(r: NotifyResult, who = "parents") {
  const how = [r.channels.whatsapp && `${r.channels.whatsapp} WhatsApp`, r.channels.sms && `${r.channels.sms} SMS`]
    .filter(Boolean).join(", ");
  const out: string[] = [];
  if (r.sent) out.push(`${r.sent} ${who} told (${how} · ${ghs(r.costPesewas)}).`);
  if (r.held) out.push(`${r.held} not sent — not enough messaging balance. Top up under Billing.`);
  if (r.free) out.push(`${r.free} reached in the app or on Telegram, free.`);
  return out.join(" ");
}
