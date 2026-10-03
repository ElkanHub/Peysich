import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { guardians, messageLinks, messages } from "@/db/schema";
import { uid } from "@/lib/utils";
import { loadRecipients, notifyMany, route, routeEnv, type NotifyResult, type NotifySchool } from "./notify";
import { linkUrl, titleOf } from "./render";
import { getBalance } from "./wallet";

/** Free text lives in the app (docs/MESSAGING_BUILD_PLAN.md §4): a notice or
 *  announcement is a `messages` row first; the ping carries its title and a
 *  one-tap link, and opening the link marks it read. */

/** 12 characters of [A-Za-z0-9_-]: short enough for an SMS, 72 bits of guess-proof. */
const newToken = () => Buffer.from(crypto.getRandomValues(new Uint8Array(9))).toString("base64url");

const rowsFor = (m: { id: string; title: string; body: string }, links: { guardianId: string; token: string }[]) =>
  links.map((l) => ({
    to: { kind: "guardian" as const, id: l.guardianId }, kind: "announcement_ping" as const, messageId: m.id,
    vars: { title: m.title }, link: linkUrl(l.token), url: "/comms", fullText: m.body,
  }));

/** One guardian per phone number — siblings' shared parent is told once. */
async function audience(schoolId: string) {
  const gs = await db.select({ id: guardians.id, phone: guardians.phone }).from(guardians).where(eq(guardians.schoolId, schoolId));
  const seen = new Set<string>();
  return gs.filter((g) => g.phone && !seen.has(g.phone) && seen.add(g.phone)).map((g) => g.id);
}

/** Who a message to every parent reaches and how, with the prices and the
 *  balance — everything the send confirm needs to count the cost live as the
 *  text is typed (the text decides the SMS parts, not the split). */
export async function parentReach(school: NotifySchool) {
  const tos = (await audience(school.id)).map((id) => ({ kind: "guardian" as const, id }));
  const [env, people, balance] = await Promise.all([routeEnv(), loadRecipients(school.id, tos), getBalance(school.id)]);
  const reach = { whatsapp: 0, smsPing: 0, smsFull: 0, free: 0, balance, smsPrice: env.smsPrice, whatsappPrice: env.whatsappPrice };
  for (const r of people.values()) {
    const plan = route({ school, kind: "announcement_ping", vars: { title: "x" }, link: "x", fullText: "x" }, r, env);
    if (plan.some((p) => p.channel === "whatsapp")) reach.whatsapp++;
    else if (plan.some((p) => p.channel === "sms")) reach[r.phoneOnly ? "smsFull" : "smsPing"]++;
    else if (plan.length) reach.free++;
  }
  return reach;
}
export type ParentReach = Awaited<ReturnType<typeof parentReach>>;

/** Write the message, give every parent their own link, and ping them. */
export async function sendToParents(school: NotifySchool, o: { body: string; createdBy: string }): Promise<NotifyResult> {
  const m = { id: uid(), title: titleOf(o.body), body: o.body };
  const links = (await audience(school.id)).map((guardianId) => ({ guardianId, token: newToken() }));
  await db.insert(messages).values({ ...m, schoolId: school.id, kind: "announcement", createdBy: o.createdBy });
  if (links.length) await db.insert(messageLinks).values(links.map((l) => ({
    token: l.token, messageId: m.id, recipientKind: "guardian", recipientId: l.guardianId,
  })));
  return notifyMany(school, rowsFor(m, links));
}

/** "Remind the rest": ping again everyone who has not opened their link. */
export async function remindUnread(school: NotifySchool, messageId: string): Promise<NotifyResult | null> {
  const [m] = await db.select().from(messages).where(and(eq(messages.id, messageId), eq(messages.schoolId, school.id)));
  if (!m) return null;
  const links = await db.select({ guardianId: messageLinks.recipientId, token: messageLinks.token }).from(messageLinks)
    .where(and(eq(messageLinks.messageId, m.id), isNull(messageLinks.openedAt)));
  return notifyMany(school, rowsFor(m, links));
}

/** Who has opened each message and who has not — "Read by 112 of 180", with the list. */
export async function readers(messageIds: string[]) {
  const out = new Map<string, { read: string[]; unread: string[] }>();
  if (!messageIds.length) return out;
  const rows = await db.select({
    id: messageLinks.messageId, name: guardians.name, opened: sql<boolean>`${messageLinks.openedAt} is not null`,
  }).from(messageLinks).innerJoin(guardians, eq(messageLinks.recipientId, guardians.id))
    .where(inArray(messageLinks.messageId, messageIds)).orderBy(guardians.name);
  for (const r of rows) {
    const e = out.get(r.id) ?? { read: [], unread: [] };
    (r.opened ? e.read : e.unread).push(r.name);
    out.set(r.id, e);
  }
  return out;
}
