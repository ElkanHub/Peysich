"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireSchool } from "@/core/school-context";
import { getSession } from "@/core/session";
import { db } from "@/db";
import { schools } from "@/db/schema";
import { withFlash } from "@/lib/flash";
import { initCheckout, onlinePayEnabled } from "@/lib/paystack";
import {
  addManualCredit, CHANNELS, ghs, MIN_TOPUP_PESEWAS, setPrice, topUpReference, type Channel,
} from "./wallet";
import { logTimeline, syncWhatsApp } from "./platform";
import { setTelegramWebhook, telegramConfigured } from "./providers/telegram";
import { EDITABLE_SETTINGS, getSettings, setSetting } from "./settings";

/** School side: open Paystack for a wallet top-up. The form posts either a
 *  preset button (`amount`) or the typed box (`custom`), in cedis. */
export async function startWalletTopUp(slug: string, f: FormData) {
  const { school, user } = await requireSchool(slug, ["admin"]);
  const ghsIn = Number(f.get("amount") || f.get("custom") || 0);
  const pesewas = Math.round(ghsIn * 100);
  if (!Number.isFinite(pesewas) || pesewas < MIN_TOPUP_PESEWAS)
    redirect(withFlash("/billing", `The smallest top-up is ${ghs(MIN_TOPUP_PESEWAS)}. Nothing was charged.`, { error: true }));
  if (!onlinePayEnabled)
    redirect(withFlash("/billing", "Online payment is not switched on yet, so top-ups are added by SchoolSpec for now. Call us.", { error: true }));
  const reference = topUpReference(pesewas);
  const email = (user as { email?: string }).email ?? `${slug}@schoolspec.com`;
  const { checkoutUrl } = await initCheckout({
    email, amountPesewas: pesewas, reference,
    callbackUrl: `/billing?topup=${reference}`,
    metadata: { kind: "wallet", schoolId: school.id },
  });
  redirect(checkoutUrl);
}

async function requirePlatformAdmin() {
  const session = await getSession();
  const u = session?.user as { id: string; role: string; name: string } | undefined;
  if (!u || u.role !== "platform_admin") throw new Error("Forbidden");
  return u;
}

/** Console: the price per channel, in pesewas. */
export async function updatePriceSetting(channel: string, f: FormData) {
  await requirePlatformAdmin();
  if (!CHANNELS.includes(channel as Channel)) throw new Error("Unknown channel");
  const price = Math.max(0, Math.round(Number(f.get("price") ?? 0)));
  const cost = Math.max(0, Math.round(Number(f.get("cost") ?? 0)));
  await setPrice(channel as Channel, price, cost);
  revalidatePath("/platform/settings");
}

/** Console: credit a school by hand (a cash top-up, a goodwill credit). */
export async function addSchoolCredit(schoolId: string, f: FormData) {
  const u = await requirePlatformAdmin();
  const pesewas = Math.round(Number(f.get("amountGhs") ?? 0) * 100);
  if (!(pesewas > 0)) redirect(`/platform/schools/${schoolId}`);
  const note = String(f.get("note") ?? "").trim() || "Manual credit";
  await addManualCredit(schoolId, pesewas, note, u.id);
  await logTimeline(schoolId, "credit", `${ghs(pesewas)} added — ${note}`, u.name);
  revalidatePath(`/platform/schools/${schoolId}`);
  redirect(`/platform/schools/${schoolId}`);
}

/** Console: "Log a call" / "Log a visit". Besides the record, it holds every
 *  automatic message to the school for seven days. */
export async function logContact(schoolId: string, kind: "call" | "visit", f: FormData) {
  const u = await requirePlatformAdmin();
  await logTimeline(schoolId, kind === "visit" ? "visit" : "call", String(f.get("note") ?? "").trim().slice(0, 500), u.name);
  revalidatePath(`/platform/schools/${schoolId}`);
  redirect(withFlash(`/platform/schools/${schoolId}`,
    `${kind === "visit" ? "Visit" : "Call"} logged. Automatic messages to this school are held for 7 days.`));
}

/** Console: pause or resume every automatic message to one school. */
export async function setAutoMessagesPaused(schoolId: string, paused: boolean) {
  const u = await requirePlatformAdmin();
  await db.update(schools).set({ autoMessagesPaused: paused }).where(eq(schools.id, schoolId));
  await logTimeline(schoolId, paused ? "paused" : "resumed", paused ? "Automatic messages paused" : "Automatic messages resumed", u.name);
  revalidatePath(`/platform/schools/${schoolId}`);
  redirect(withFlash(`/platform/schools/${schoolId}`,
    paused ? "Paused. This school gets no automatic messages until you resume." : "Resumed. Automatic messages will go again."));
}

/** Console: the messaging settings form. */
export async function saveMessagingSettings(f: FormData) {
  await requirePlatformAdmin();
  for (const [key] of EDITABLE_SETTINGS) await setSetting(key, String(f.get(key) ?? "").trim());
  revalidatePath("/platform/settings");
  redirect(withFlash("/platform/settings", "Messaging settings saved. They apply to the next send."));
}

/** Console: ask Meta for every template's status now (the daily sweep also does). */
export async function syncTemplatesNow() {
  await requirePlatformAdmin();
  const s = await getSettings();
  const n = await syncWhatsApp(s.wa_number_school, s.wa_quality);
  revalidatePath("/platform/settings");
  redirect(withFlash("/platform/settings",
    n ? `${n} WhatsApp templates checked with Meta.` : "Nothing came back from Meta. Check WHATSAPP_TOKEN and WHATSAPP_BUSINESS_ACCOUNT_ID.", { error: !n }));
}

/** Console: point both Telegram bots at this deployment. Done once per domain. */
export async function connectTelegram() {
  await requirePlatformAdmin();
  const h = await headers();
  const origin = `https://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const done: string[] = [];
  try {
    for (const bot of ["school", "ops"] as const)
      if (telegramConfigured(bot)) { await setTelegramWebhook(bot, origin); done.push(bot === "ops" ? "the ops bot" : "the school bot"); }
  } catch (e) {
    redirect(withFlash("/platform/settings", `Telegram said no: ${e instanceof Error ? e.message : e}`, { error: true }));
  }
  redirect(withFlash("/platform/settings", done.length
    ? `Connected ${done.join(" and ")}. Now send /start to the ops bot from your phone.`
    : "No Telegram bot token is set yet (TELEGRAM_BOT_TOKEN, TELEGRAM_OPS_TOKEN).", { error: !done.length }));
}
