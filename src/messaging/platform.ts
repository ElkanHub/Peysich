import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  attendanceRecords, messageTemplates, outbox, platformSchedule, platformTimeline, schools, students,
  subscriptions, user, walletLedger,
} from "@/db/schema";
import { uid } from "@/lib/utils";
import { drainOutbox, opsAlert } from "./outbox";
import { fetchWhatsAppQuality, fetchWhatsAppTemplates, waNumber, whatsappConfigured } from "./providers/whatsapp";
import { fill, schoolUrl, waParams, type Vars } from "./render";
import { getSettings, setSetting } from "./settings";
import { PLATFORM_TEMPLATES, type PlatformTemplate } from "./templates";
import { getBalance, ghs, LOW_BALANCE_PESEWAS } from "./wallet";

/** The platform plane (docs/MESSAGING_BUILD_PLAN.md §6): SchoolSpec to its
 *  schools. Email for what they keep, WhatsApp for what they must see today.
 *  Same outbox, no wallet. Everything sent or skipped lands on the school's
 *  timeline in the console. */

type School = typeof schools.$inferSelect;
const DAY = 86400000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(+d + n * DAY);

export async function logTimeline(schoolId: string, event: string, detail: string, by?: string | null) {
  await db.insert(platformTimeline).values({ id: uid(), schoolId, event, detail, by: by ?? null });
}

/** The head: the school's first admin account. */
async function owner(schoolId: string) {
  const [u] = await db.select({ name: user.name, email: user.email }).from(user)
    .where(and(eq(user.schoolId, schoolId), eq(user.role, "admin"))).orderBy(user.createdAt).limit(1);
  return { first: u?.name.split(" ")[0] ?? "there", email: u?.email ?? null };
}

const emailHtml = (text: string, cta?: { label: string; url: string }) => `
  <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;font-size:16px;line-height:1.6;color:#1f2937">
    <p style="font-weight:700;font-size:18px;margin:0 0 16px">SchoolSpec</p>
    ${text.split("\n").map((p) => `<p style="margin:0 0 12px">${p}</p>`).join("")}
    ${cta ? `<p style="margin:20px 0"><a href="${cta.url}" style="background:#5E1D3E;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600">${cta.label}</a></p>` : ""}
    <p style="margin-top:24px;color:#6b7280;font-size:13px">Questions? Reply to this email${process.env.OPS_PHONE ? ` or call ${process.env.OPS_PHONE}` : ""}.</p>
  </div>`;

export type PlatformMessage = {
  label: string;                 // the timeline's words: "Trial ends in 3 days"
  wa?: PlatformTemplate;
  email?: { subject: string; text: string; cta?: { label: string; url: string } };
  vars?: Vars;
};

/** One message from SchoolSpec to one school. Returns the channels it went on. */
export async function notifyPlatform(school: School, m: PlatformMessage): Promise<string[]> {
  const [who, settings] = await Promise.all([owner(school.id), getSettings()]);
  const vars = { first: who.first, name: school.name, ops: settings.ops_phone, link: schoolUrl(school.slug, "/billing"), ...m.vars };
  const rows: (typeof outbox.$inferInsert)[] = [];
  const base = { schoolId: school.id, plane: "platform", kind: m.wa ?? "platform-email", nextTryAt: new Date() };
  if (m.wa && school.ownerPhone && whatsappConfigured()) {
    const [ok] = await db.select().from(messageTemplates)
      .where(and(eq(messageTemplates.name, m.wa), eq(messageTemplates.status, "APPROVED")));
    const params = ok ? waParams(PLATFORM_TEMPLATES[m.wa], vars) : null;
    if (params) rows.push({
      ...base, id: uid(), channel: "whatsapp", to: waNumber(school.ownerPhone), body: fill(PLATFORM_TEMPLATES[m.wa], vars),
      meta: { template: m.wa, params },
    });
  }
  if (m.email && who.email) rows.push({
    ...base, id: uid(), channel: "email", to: who.email, body: fill(m.email.text, vars),
    meta: { subject: fill(m.email.subject, vars), html: emailHtml(fill(m.email.text, vars), m.email.cta), fromName: "SchoolSpec" },
  });
  if (rows.length) {
    await db.insert(outbox).values(rows);
    await drainOutbox({ ids: rows.map((r) => r.id) });
  }
  const on = rows.map((r) => r.channel === "whatsapp" ? "WhatsApp" : "email");
  await logTimeline(school.id, on.length ? "sent" : "skipped",
    on.length ? `${m.label} — ${on.join(" and ")}` : `${m.label} — no WhatsApp number or email to send it to`);
  return on;
}

// ── things that happen ─────────────────────────────────────────────────

export async function onSignUp(schoolId: string) {
  const [school] = await db.select().from(schools).where(eq(schools.id, schoolId));
  if (!school) return;
  await logTimeline(schoolId, "stage", "Signed up");
  await notifyPlatform(school, {
    label: "Welcome",
    email: {
      subject: "Welcome to SchoolSpec, {{first}}",
      text: "Hello {{first}},\n{{name}} is set up on SchoolSpec and your 14-day free trial has started.\nThe first thing to do is add your classes and your children. It takes about an hour, and we will come and do it with you if you like.",
      cta: { label: "Open your school", url: schoolUrl(school.slug, "/") },
    },
  });
  await opsAlert(`New sign-up: ${school.name}${school.ownerPhone ? ` · ${school.ownerPhone}` : ""}`);
}

export async function onPlanPaid(schoolId: string, planName: string, amountPesewas: number, until: Date) {
  const [school] = await db.select().from(schools).where(eq(schools.id, schoolId));
  if (!school) return;
  await notifyPlatform(school, {
    label: `Payment received: ${planName}`,
    email: {
      subject: "Receipt: {{name}}'s SchoolSpec plan",
      text: `Hello {{first}},\nWe received ${ghs(amountPesewas)} for {{name}}'s ${planName} plan. It runs until ${until.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.\nThank you.`,
    },
  });
}

export async function onTopUp(schoolId: string, pesewas: number) {
  const [school] = await db.select().from(schools).where(eq(schools.id, schoolId));
  if (!school) return;
  await notifyPlatform(school, {
    label: `Top-up ${ghs(pesewas)}`,
    email: {
      subject: "Receipt: messaging top-up for {{name}}",
      text: `Hello {{first}},\n${ghs(pesewas)} was added to {{name}}'s messaging balance. The balance is now ${ghs(await getBalance(schoolId))}. It never expires.`,
    },
  });
}

// ── the calendar ────────────────────────────────────────────────────────

type Facts = { students: number; registers: number; noPlan: boolean; sub?: typeof subscriptions.$inferSelect };
type CalEvent = PlatformMessage & {
  key: string; due: Date;
  /** Checked at send time: a reason not to send, or null to go ahead. */
  skipIf: (f: Facts) => string | null;
  /** Day-2 and day-5 nudges go to the operator first, until there are more than ten schools. */
  opsFirst?: boolean;
};

const chosen = (f: Facts) => f.noPlan ? null : "a plan has been chosen";

/** Every automatic message this school could get, with its due date. */
export function calendarFor(s: School, sub?: typeof subscriptions.$inferSelect): CalEvent[] {
  const bill = { label: "Choose a plan", url: schoolUrl(s.slug, "/billing") };
  const out: CalEvent[] = [
    { key: "setup_day2", due: addDays(s.createdAt, 2), label: "Day 2: offer to set up", wa: "setup_day2", opsFirst: true,
      skipIf: (f) => f.students ? "the roll is no longer empty" : null },
    { key: "setup_day5", due: addDays(s.createdAt, 5), label: "Day 5: first register", wa: "setup_day5", opsFirst: true,
      skipIf: (f) => f.registers ? "a register has been saved" : null },
    { key: "data_here_21", due: addDays(s.createdAt, 21), label: "Your data is still here", skipIf: chosen,
      email: { subject: "{{name}}'s data is still here", text: "Hello {{first}},\n{{name}}'s trial has ended, and everything you entered is safe. Choose a plan any time and carry on where you stopped.", cta: bill } },
    { key: "data_here_60", due: addDays(s.createdAt, 60), label: "Your data is still here", skipIf: chosen,
      email: { subject: "{{name}}'s data is still here", text: "Hello {{first}},\n{{name}}'s records are still safe on SchoolSpec. Choose a plan any time and carry on where you stopped.", cta: bill } },
    { key: "deletion_10_days", due: addDays(s.createdAt, 80), label: "Data deleted in 10 days", wa: "deletion_10_days", skipIf: chosen,
      email: { subject: "{{name}}'s data will be deleted in 10 days", text: "Hello {{first}},\n{{name}}'s data on SchoolSpec will be deleted in 10 days unless you ask us to keep it. Reply to this email or call {{ops}}.", cta: bill } },
  ];
  if (s.trialEndsAt) out.push(
    { key: "trial_3_days", due: addDays(s.trialEndsAt, -3), label: "Trial ends in 3 days", wa: "trial_3_days", skipIf: chosen,
      email: { subject: "{{name}}'s free trial ends in 3 days", text: "Hello {{first}},\n{{name}}'s free trial on SchoolSpec ends in 3 days. Choose a plan to keep going. Nothing is deleted either way.", cta: bill } },
    { key: "trial_ended", due: s.trialEndsAt, label: "Trial ended", wa: "trial_ended", skipIf: chosen,
      email: { subject: "{{name}}'s trial has ended", text: "Hello {{first}},\n{{name}}'s trial has ended. Your data is safe. Choose a plan any time.", cta: bill } },
  );
  if (sub) {
    const end = sub.periodEnd, k = ymd(end), amount = (sub.amountPesewas / 100).toFixed(2);
    const pay = { label: "Pay now", url: schoolUrl(s.slug, "/billing") };
    const unpaid = (f: Facts) => f.sub?.id === sub.id ? null : "the plan has been paid";
    out.push(
      { key: `renewal_7:${k}`, due: addDays(end, -7), label: "Renewal in 7 days", skipIf: unpaid,
        email: { subject: "{{name}}'s SchoolSpec plan renews in 7 days", text: `Hello {{first}},\n{{name}}'s SchoolSpec plan renews in 7 days: GHS ${amount}.`, cta: pay } },
      { key: `renewal_tomorrow:${k}`, due: addDays(end, -1), label: "Renewal tomorrow", wa: "renewal_tomorrow", vars: { amount }, skipIf: unpaid },
      ...[0, 3, 7].map((n): CalEvent => ({
        key: `payment_failed_${n}:${k}`, due: addDays(end, n), label: "Payment did not go through", wa: "payment_failed", skipIf: unpaid,
        email: { subject: "{{name}}'s SchoolSpec payment did not go through", text: "Hello {{first}},\nThe payment for {{name}}'s SchoolSpec plan did not go through. The school stays open for 14 days. Please try again.", cta: pay },
      })),
      { key: `suspended:${k}`, due: addDays(end, 14), label: "Account paused", wa: "suspended", skipIf: unpaid,
        email: { subject: "{{name}}'s SchoolSpec account is paused", text: "Hello {{first}},\n{{name}}'s SchoolSpec account is paused today because the plan is unpaid. Pay and it reopens at once. Your data is safe.", cta: pay } },
    );
  }
  return out;
}

/** The next automatic message a school is due, for the pipeline board. */
export function nextDue(s: School, sub?: typeof subscriptions.$inferSelect) {
  const today = ymd(new Date());
  return calendarFor(s, sub).filter((e) => ymd(e.due) >= today).sort((a, b) => +a.due - +b.due)[0] ?? null;
}

const stageOf = (s: School, f: Facts, now: Date) =>
  s.status === "suspended" ? "suspended"
    : s.status === "expired" || s.status === "archived" ? "left"
      : s.status === "past_due" ? "past_due"
        : s.status === "active" ? "paying"
          : s.trialEndsAt && +s.trialEndsAt - +now <= 3 * DAY ? "trial_ending"
            : f.registers ? "live" : f.students ? "setting_up" : "signed_up";

export const STAGES = ["signed_up", "setting_up", "live", "trial_ending", "paying", "past_due", "suspended", "left"] as const;
export const STAGE_WORDS: Record<string, string> = {
  signed_up: "Signed up", setting_up: "Setting up", live: "Live", trial_ending: "Trial ending",
  paying: "Paying", past_due: "Past due", suspended: "Suspended", left: "Left",
};

/** Fire one schedule key at most once: the row is the lock. */
async function once(schoolId: string, eventKey: string, due: Date, run: () => Promise<string | null>) {
  const claimed = await db.insert(platformSchedule).values({ schoolId, eventKey, dueOn: ymd(due) })
    .onConflictDoNothing().returning({ k: platformSchedule.eventKey });
  if (!claimed.length) return;
  const skipped = await run();
  await db.update(platformSchedule).set(skipped ? { skipped } : { sentAt: new Date() })
    .where(and(eq(platformSchedule.schoolId, schoolId), eq(platformSchedule.eventKey, eventKey)));
}

/** The daily sweep (the dunning cron, grown): move schools between stages,
 *  send what the calendar says is due today — checking each condition now —
 *  and write down everything sent or skipped. */
export async function platformSweep() {
  const now = new Date(), today = ymd(now), yesterday = ymd(addDays(now, -1));
  const [all, settings] = await Promise.all([db.select().from(schools), getSettings()]);
  const autoNudges = all.length > 10;

  for (const s of all) {
    if (s.status === "archived") continue;
    const [[st], [att], subs, recentTalk] = await Promise.all([
      db.select({ n: sql<number>`count(*)` }).from(students).where(and(eq(students.schoolId, s.id), eq(students.status, "active"))),
      db.select({ n: sql<number>`count(*)` }).from(attendanceRecords).where(eq(attendanceRecords.schoolId, s.id)),
      db.select().from(subscriptions).where(eq(subscriptions.schoolId, s.id)).orderBy(desc(subscriptions.periodEnd)).limit(1),
      db.select({ at: platformTimeline.createdAt, event: platformTimeline.event }).from(platformTimeline)
        .where(and(eq(platformTimeline.schoolId, s.id), inArray(platformTimeline.event, ["call", "visit"]),
          gte(platformTimeline.createdAt, addDays(now, -7)))).limit(1),
    ]);
    const sub = subs[0];
    const f: Facts = { students: Number(st.n), registers: Number(att.n), noPlan: !sub, sub };

    const stage = stageOf(s, f, now);
    if (stage !== s.stage) {
      await db.update(schools).set({ stage, stageSince: now }).where(eq(schools.id, s.id));
      await logTimeline(s.id, "stage", `${STAGE_WORDS[s.stage] ?? s.stage} → ${STAGE_WORDS[stage]}`);
      if (stage === "past_due") await opsAlert(`Failed payment: ${s.name} is past due.`);
      if (stage === "suspended") await opsAlert(`Suspended: ${s.name}.`);
    }

    const hush = s.autoMessagesPaused ? "automatic messages are paused for this school"
      : recentTalk[0] ? `you logged a ${recentTalk[0].event} on ${ymd(recentTalk[0].at)}` : null;
    const fire = (e: Pick<CalEvent, "key" | "due" | "label">, send: () => Promise<unknown>, why: string | null) =>
      once(s.id, e.key, e.due, async () => {
        const skip = hush ?? why;
        if (skip) { await logTimeline(s.id, "skipped", `${e.label} — ${skip}`); return skip; }
        await send();
        return null;
      });

    // a day's grace, so one missed cron does not lose a message; older ones never fire late
    for (const e of calendarFor(s, sub)) {
      const due = ymd(e.due);
      if (due !== today && due !== yesterday) continue;
      await fire(e, async () => {
        if (e.opsFirst && !autoNudges) {
          await opsAlert(`${e.label} — ${s.name}${s.ownerPhone ? ` (${s.ownerPhone})` : ""}. Send the nudge yourself, or call.`);
          await logTimeline(s.id, "sent", `${e.label} — sent to you on Telegram to decide`);
        } else await notifyPlatform(s, e);
      }, e.skipIf(f));
    }

    // the wallet: once per dip — the key is the last money in, so a top-up re-arms it
    const balance = await getBalance(s.id);
    if (balance < LOW_BALANCE_PESEWAS) {
      const [credit] = await db.select({ id: walletLedger.id }).from(walletLedger)
        .where(and(eq(walletLedger.schoolId, s.id), sql`${walletLedger.pesewas} > 0`, sql`${walletLedger.kind} <> 'refund'`))
        .orderBy(desc(walletLedger.createdAt)).limit(1);
      const dip = credit?.id ?? "start";
      if (balance <= 0) await fire({ key: `wallet_empty:${dip}`, due: now, label: "Messaging balance empty" }, () => notifyPlatform(s, {
        label: "Messaging balance empty", wa: "wallet_empty",
        email: { subject: "{{name}}'s messaging balance is empty", text: "Hello {{first}},\n{{name}}'s messaging balance is empty, so paid pings have stopped. Notices still reach the app and Telegram. Absence alerts and emergencies still go.", cta: { label: "Top up", url: schoolUrl(s.slug, "/billing") } },
      }), null);
      else await fire({ key: `wallet_low:${dip}`, due: now, label: "Messaging balance low" }, () => notifyPlatform(s, {
        label: "Messaging balance low", wa: "wallet_low", vars: { amount: (balance / 100).toFixed(2) },
      }), null);
    }
  }

  await syncWhatsApp(settings.wa_number_school, settings.wa_quality);
  await digest(all, addDays(now, -1));
}

/** Meta's verdict on every template, and the number's quality rating. */
export async function syncWhatsApp(phoneNumberId: string, lastQuality: string) {
  try {
    const rows = await fetchWhatsAppTemplates();
    for (const t of rows) await db.insert(messageTemplates).values({ ...t, syncedAt: new Date() })
      .onConflictDoUpdate({ target: messageTemplates.name, set: { status: t.status, category: t.category, syncedAt: new Date() } });
    const q = await fetchWhatsAppQuality(phoneNumberId);
    if (q && q !== lastQuality) {
      await setSetting("wa_quality", q);
      const rank = ["GREEN", "YELLOW", "RED"];
      if (lastQuality && rank.indexOf(q) > rank.indexOf(lastQuality)) await opsAlert(`Meta quality rating dropped: ${lastQuality} → ${q}.`);
    }
    return rows.length;
  } catch { return 0; }
}

/** The 7:00 digest on the ops bot. */
async function digest(all: School[], since: Date) {
  const sends = await db.select({ status: outbox.status, n: sql<number>`count(*)` }).from(outbox)
    .where(gte(outbox.createdAt, since)).groupBy(outbox.status);
  const n = (st: string[]) => sends.filter((x) => st.includes(x.status)).reduce((a, x) => a + Number(x.n), 0);
  const by = (stage: string) => all.filter((s) => s.stage === stage).length;
  await opsAlert([
    `Good morning. ${all.length} schools: ${by("paying")} paying, ${by("live") + by("setting_up") + by("signed_up") + by("trial_ending")} on trial, ${by("past_due")} past due, ${by("suspended")} suspended.`,
    `Last 24 hours: ${n(["sent", "delivered", "read"])} messages sent, ${n(["failed"])} failed, ${n(["held"])} held for an empty wallet.`,
  ].join("\n"));
}
