import { pgTable, text, timestamp, integer, boolean, date, jsonb, index, uniqueIndex, primaryKey } from "drizzle-orm/pg-core";
import { schools } from "./platform";

// ── Messaging wallet (docs/MESSAGING_BUILD_PLAN.md §2) ──
// The ledger and the price list first; the outbox, the free text, contact
// channels and the platform plane follow below.

/** Every pesewa in or out of a school's messaging wallet. Balance = SUM(pesewas).
 *  No balance column, so nothing can drift. `reference` is unique where set:
 *  a Paystack reference, an outbox id, or `start_<schoolId>` — which is what
 *  makes top-ups and the starting credit idempotent. */
export const walletLedger = pgTable("wallet_ledger", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // topup|charge|refund|starting_credit|manual
  pesewas: integer("pesewas").notNull(), // signed: credits +, charges −
  reference: text("reference"),
  note: text("note"),
  pricePesewas: integer("price_pesewas"), // unit price at the time, for charges
  channel: text("channel"), // sms|whatsapp|telegram|push|email
  outboxId: text("outbox_id"), // the send this charge or refund belongs to
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("wallet_ledger_school_idx").on(t.schoolId, t.createdAt),
  uniqueIndex("wallet_ledger_reference_idx").on(t.reference),
]);

/** One row per channel: what the school pays and what it costs us. */
export const priceSettings = pgTable("price_settings", {
  channel: text("channel").primaryKey(), // sms|whatsapp|telegram|push|email
  pricePesewas: integer("price_pesewas").notNull(),
  costPesewas: integer("cost_pesewas").notNull(),
  effectiveFrom: timestamp("effective_from").notNull().defaultNow(),
});

// ── Steps 2–6: the log, the free text, contact channels, the platform plane ──

/** One row per recipient per channel — the queue the minute worker drains and
 *  the log every page reads. `sms_log` was copied in once (migration 0032) and
 *  is no longer written. `plane` = school (charged to the wallet) | platform. */
export const outbox = pgTable("outbox", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").references(() => schools.id, { onDelete: "cascade" }),
  plane: text("plane").notNull().default("school"),
  messageId: text("message_id"),
  kind: text("kind").notNull(), // absence|fees|receipt|blast|notice|emergency|…
  channel: text("channel").notNull(), // sms|whatsapp|telegram|push|email
  to: text("to").notNull(), // phone, Telegram chat id, user id (push) or email
  body: text("body").notNull(),
  /** What the provider needs beyond the text: WhatsApp template + params, the
   *  SMS sender name, the push title/url, and the SMS to fall back to. */
  meta: jsonb("meta").$type<OutboxMeta>().notNull().default({}),
  status: text("status").notNull().default("queued"), // queued|sending|sent|delivered|read|failed|held
  providerId: text("provider_id"),
  parts: integer("parts").notNull().default(1),
  pricePesewas: integer("price_pesewas").notNull().default(0), // what left the wallet
  attempts: integer("attempts").notNull().default(0),
  nextTryAt: timestamp("next_try_at").notNull().defaultNow(),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  sentAt: timestamp("sent_at"),
}, (t) => [
  index("outbox_school_idx").on(t.schoolId, t.createdAt),
  index("outbox_queue_idx").on(t.status, t.nextTryAt),
  index("outbox_provider_idx").on(t.providerId),
]);

export type OutboxMeta = {
  senderId?: string;
  template?: string; params?: string[]; // WhatsApp
  title?: string; url?: string;          // push
  subject?: string; html?: string; fromName?: string; // email
  smsFallback?: { to: string; body: string }; // sent if WhatsApp fails for good
  bot?: "ops";                            // Telegram: the operator bot
  doc?: { kind: "invoice" | "receipt"; id: string; name: string }; // the PDF to attach (email) or send (Telegram)
};

/** Free text that lives in the app: the ping carries its title and a link. */
export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // notice|announcement|emergency
  title: text("title").notNull(),
  body: text("body").notNull(),
  classId: text("class_id"),     // audience: a class…
  studentId: text("student_id"), // …or one child; both null = everyone
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("messages_school_idx").on(t.schoolId, t.createdAt)]);

/** The one-tap link: an unguessable token → one message for one recipient. */
export const messageLinks = pgTable("message_links", {
  token: text("token").primaryKey(),
  messageId: text("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  recipientKind: text("recipient_kind").notNull(), // guardian|staff
  recipientId: text("recipient_id").notNull(),
  openedAt: timestamp("opened_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("message_links_recipient_idx").on(t.messageId, t.recipientKind, t.recipientId)]);

/** How to reach a guardian or staff member beyond their phone number. */
export const contactChannels = pgTable("contact_channels", {
  ownerKind: text("owner_kind").notNull(), // guardian|staff
  ownerId: text("owner_id").notNull(),
  schoolId: text("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  whatsapp: text("whatsapp"),
  whatsappConsent: boolean("whatsapp_consent").notNull().default(false),
  telegramChatId: text("telegram_chat_id"),
  linkedAt: timestamp("linked_at"),
}, (t) => [
  primaryKey({ columns: [t.ownerKind, t.ownerId] }),
  index("contact_channels_school_idx").on(t.schoolId),
]);

/** Meta's verdict on each WhatsApp template; the wording lives in
 *  src/messaging/templates.ts. Synced from the console and the daily sweep. */
export const messageTemplates = pgTable("message_templates", {
  name: text("name").primaryKey(),
  status: text("status").notNull(), // APPROVED|PENDING|REJECTED|PAUSED
  category: text("category"),
  syncedAt: timestamp("synced_at").notNull().defaultNow(),
});

/** Console-editable messaging settings (overdraft, starting credit, ops phone,
 *  WhatsApp numbers, daily cap) and small bits of state (ops chat id). */
export const messagingSettings = pgTable("messaging_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/** Everything that happened between SchoolSpec and a school, newest first. */
export const platformTimeline = pgTable("platform_timeline", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  event: text("event").notNull(), // stage|sent|skipped|call|visit|paused|resumed|credit
  detail: text("detail").notNull().default(""),
  by: text("by"), // console user's name; null = automatic
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("platform_timeline_school_idx").on(t.schoolId, t.createdAt)]);

/** One row per school and calendar event, so nothing sends twice. */
export const platformSchedule = pgTable("platform_schedule", {
  schoolId: text("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  eventKey: text("event_key").notNull(), // trial_3_days, payment_failed_3:2026-11-01 …
  dueOn: date("due_on").notNull(),
  sentAt: timestamp("sent_at"),
  skipped: text("skipped"), // why it did not send
}, (t) => [primaryKey({ columns: [t.schoolId, t.eventKey] })]);
