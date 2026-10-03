import { db } from "@/db";
import { messagingSettings } from "@/db/schema";

/** Console → Messaging settings (docs/MESSAGING_BUILD_PLAN.md §5). Defaults
 *  are the decisions in docs/MESSAGING_SETUP.md §0; a row in
 *  `messaging_settings` overrides one. Money is in pesewas. */
export const SETTING_DEFAULTS = {
  overdraft_pesewas: "2000",        // urgent and absence may go this far below zero
  starting_credit_pesewas: "2000",  // every new school
  wa_daily_cap: "250",              // distinct WhatsApp recipients a day (Meta's limit before verification)
  ops_phone: process.env.OPS_PHONE ?? "",
  wa_number_school: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",   // phone_number_id per plane:
  wa_number_platform: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "", // one number now, two later
  ops_chat_id: "",                  // captured when you send /start to the ops bot
  wa_quality: "",                   // Meta's last quality rating, to notice a drop
  failrate_alert_at: "",            // last provider-failure alert, so it rings once an hour
} as const;
export type SettingKey = keyof typeof SETTING_DEFAULTS;

/** The ones the console form edits, with their labels. */
export const EDITABLE_SETTINGS: [SettingKey, string][] = [
  ["overdraft_pesewas", "Overdraft limit (pesewas)"],
  ["starting_credit_pesewas", "Starting credit (pesewas)"],
  ["ops_phone", "Ops phone number (shown in platform messages)"],
  ["wa_number_school", "WhatsApp phone number id — schools to parents"],
  ["wa_number_platform", "WhatsApp phone number id — SchoolSpec to schools"],
  ["wa_daily_cap", "WhatsApp recipients a day"],
];

export async function getSettings(): Promise<Record<SettingKey, string>> {
  const out: Record<string, string> = { ...SETTING_DEFAULTS };
  for (const r of await db.select().from(messagingSettings)) if (r.key in out) out[r.key] = r.value;
  return out as Record<SettingKey, string>;
}

export async function setSetting(key: SettingKey, value: string) {
  await db.insert(messagingSettings).values({ key, value })
    .onConflictDoUpdate({ target: messagingSettings.key, set: { value } });
}
