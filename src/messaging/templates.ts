/** The template table, in code (docs/MESSAGING_BUILD_PLAN.md §1). One fixed
 *  sentence per kind; `{{var}}` slots. The SMS wording is EXACTLY what each
 *  call site sent before notify() existed — change it here and nowhere else.
 *  `log` is the kind written to the outbox, kept identical to the old call
 *  sites so every page that reads the log keeps working.
 *
 *  `wa` is the WhatsApp template Meta approved (docs/MESSAGING_SETUP.md §7):
 *  its name, and its text when that differs from the SMS. Meta's `{{1}}…{{n}}`
 *  are our named slots in order of first appearance — waParams() does that.
 *  Meta's verdict per name lives in the `message_templates` table.
 *  Pure and client-safe: the send confirm renders with it live. */

export type Template = { sms: string; log: string; wa?: { name: string; text?: string } };

export const TEMPLATES = {
  // ── fixed sentences ──
  absence: { log: "absence", sms: "{{child}} was marked absent today at {{school}}. Contact the office if unexpected.",
    wa: { name: "absence_alert", text: "{{school}}: {{child}} was marked absent today. Contact the office on {{office}} if unexpected." } },
  receipt: { log: "receipt", sms: "{{school}}: GHS {{amount}} received for {{child}}. Receipt {{receiptNo}}. Balance GHS {{balance}}. Thank you.",
    wa: { name: "receipt", text: "{{school}}: GHS {{amount}} received for {{child}}. Receipt {{receiptNo}}. Balance GHS {{balance}}." } },
  bill: { log: "fees", sms: "{{school}}: {{term}} fees are {{amount}}, due {{due}}. Pay at the office{{confirm}}.",
    wa: { name: "bill_created", text: "{{school}}: {{child}}'s fees for {{term}} are GHS {{amountNum}}, due {{due}}. Pay by MoMo to {{momo}} (name: {{school}}) or at the office." } },
  reminder: { log: "fees", sms: "{{school}}: fees of GHS {{amount}} are past due. Please settle at the office{{confirm}}.",
    wa: { name: "fee_reminder", text: "{{school}}: GHS {{amount}} is still owing for {{child}}, due {{due}}. MoMo {{momo}} (name: {{school}}) or the office. Thank you." } },
  blast: { log: "blast", sms: "{{text}} — {{school}}" },
  staff_nudge_register: { log: "staff-nudge", sms: "Good day {{first}} —the {{class}} register for today hasn't been marked yet. Please mark it in SchoolSpec. — {{school}}",
    wa: { name: "register_reminder", text: "{{school}}: the {{class}} register for today is not marked yet. Mark it in SchoolSpec: {{link}}" } },
  staff_nudge_scores: { log: "staff-nudge", sms: "Good day {{first}} — the {{class}} {{subject}} scores for this term are still missing. Please enter them in SchoolSpec. — {{school}}",
    wa: { name: "scores_reminder", text: "{{school}}: {{class}} · {{subject}} scores are still missing this term. Enter them: {{link}}" } },
  parent_login: { log: "login", sms: "{{school}}: your parent login for SchoolSpec is {{login}}, password {{password}}. Please change it after signing in.", wa: { name: "parent_login" } },
  staff_login: { log: "login", sms: "{{school}}: your SchoolSpec login is {{login}}, password {{password}}. Please change it after signing in.", wa: { name: "staff_login" } },
  team_login: { log: "staff-login", sms: "{{school}}: your SchoolSpec login is {{login}}, one-time password {{password}}. Sign in and change it under My Account." },
  admission_offer: { log: "admission-offer", sms: "{{text}}" },
  custom: { log: "custom", sms: "{{text}}" },
  // ── free text lives in the app: the ping carries the title and a link ──
  notice_ping: { log: "notice", sms: "{{school}}: new notice — \"{{title}}\". Read it: {{link}}", wa: { name: "notice_ping" } },
  announcement_ping: { log: "announcement", sms: "{{school}}: announcement — \"{{title}}\". Read it: {{link}}", wa: { name: "announcement_ping" } },
  results_ready: { log: "results", sms: "{{school}}: {{child}}'s {{term}} results are ready. See them: {{link}}", wa: { name: "results_ready" } },
  report_card_ready: { log: "report", sms: "{{school}}: {{child}}'s report card for {{term}} is ready. See it: {{link}}", wa: { name: "report_card_ready" } },
  homework_set: { log: "homework", sms: "{{school}}: new homework for {{class}} — {{title}}, due {{due}}.", wa: { name: "homework_set" } },
  emergency_illness: { log: "emergency", sms: "{{school}}: {{child}} is unwell at school. Please call {{phone}} now. Details: {{detail}}", wa: { name: "emergency_illness" } },
  emergency_injury: { log: "emergency", sms: "{{school}}: {{child}} has had an accident at school and is being looked after. Please call {{phone}}. Details: {{detail}}", wa: { name: "emergency_injury" } },
  emergency_medical: { log: "emergency", sms: "{{school}}: {{child}} needs medical attention. Please call {{phone}} immediately. Details: {{detail}}", wa: { name: "emergency_medical" } },
  emergency_behaviour: { log: "emergency", sms: "{{school}}: the head would like to speak with you about {{child}} today. Please call {{phone}}. Details: {{detail}}", wa: { name: "emergency_behaviour" } },
  emergency_come: { log: "emergency", sms: "{{school}}: please come to the school about {{child}} as soon as you can. Details: {{detail}}", wa: { name: "emergency_come" } },
  emergency_pickup: { log: "emergency", sms: "{{school}}: please collect {{child}} early today at {{time}}. Details: {{detail}}", wa: { name: "emergency_pickup" } },
} as const satisfies Record<string, Template>;

export type MessageKind = keyof typeof TEMPLATES;

/** Emergencies go by WhatsApp AND SMS; they and absence may overdraw the
 *  wallet (MESSAGING_SETUP.md §0). */
export const isEmergency = (kind: MessageKind) => kind.startsWith("emergency_");
export const urgentByDefault = (kind: MessageKind) => kind === "absence" || isEmergency(kind);

/** The six emergency buttons, in the order they are shown. */
export const EMERGENCIES = [
  ["emergency_illness", "Unwell"], ["emergency_injury", "Accident"], ["emergency_medical", "Needs medical attention"],
  ["emergency_behaviour", "Head wants to talk"], ["emergency_come", "Come to the school"], ["emergency_pickup", "Collect early"],
] as const satisfies readonly (readonly [MessageKind, string])[];

/** SchoolSpec to schools (MESSAGING_SETUP.md §7): the WhatsApp template name →
 *  its text. `first` is the head's first name, `name` the school's. */
export const PLATFORM_TEMPLATES = {
  trial_3_days: "Hello {{first}}, {{name}}'s free trial on SchoolSpec ends in 3 days. Choose a plan here: {{link}}. Nothing is deleted either way.",
  trial_ended: "Hello {{first}}, {{name}}'s trial has ended. Your data is safe. Choose a plan any time: {{link}}",
  payment_failed: "Hello {{first}}, the payment for {{name}}'s SchoolSpec plan did not go through. Try again here: {{link}}. The school stays open for 14 days.",
  suspended: "Hello {{first}}, {{name}}'s SchoolSpec account is paused today because the plan is unpaid. Pay here and it reopens at once: {{link}}",
  renewal_tomorrow: "Hello {{first}}, {{name}}'s SchoolSpec plan renews tomorrow: GHS {{amount}}.",
  wallet_low: "Hello {{first}}, {{name}}'s messaging balance is GHS {{amount}}. Top up here: {{link}}",
  wallet_empty: "Hello {{first}}, {{name}}'s messaging balance is empty, so paid pings have stopped. Notices still reach the app and Telegram. Top up: {{link}}",
  setup_day2: "Hello {{first}}, shall I come and set {{name}} up with you this week? One hour. Reply here or call {{ops}}.",
  setup_day5: "Hello {{first}}, has a teacher at {{name}} marked a register yet? If anything is in the way, call {{ops}}.",
  deletion_10_days: "Hello {{first}}, {{name}}'s data on SchoolSpec will be deleted in 10 days unless you ask us to keep it. Reply here or call {{ops}}.",
  incident: "SchoolSpec: {{text}}. We will update you here.",
} as const;
export type PlatformTemplate = keyof typeof PLATFORM_TEMPLATES;
