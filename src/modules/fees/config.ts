/** Fees & money settings (schools.settings.feesConfig) — one place, read
 *  everywhere money shows: the stub, invoices, emails, the clearance gate. */
export type FeesConfig = {
  /** The school's own collection channels, one per line, exactly as shown to parents. */
  channelsText: string;
  /** The number parents call to VERIFY before sending money electronically. */
  confirmPhone: string;
  /** Invoices fall due this many weeks after the term starts (per-item override wins). */
  dueWeeks: number;
  /** Exit / leaving-certificate behaviour when a balance is owed. */
  clearanceGate: "warn" | "block" | "off";
};

export const FEES_CONFIG_DEFAULTS: FeesConfig = {
  channelsText: "",
  confirmPhone: "",
  dueWeeks: 4,
  clearanceGate: "warn",
};

export function getFeesConfig(settings: unknown): FeesConfig {
  const raw = (settings as { feesConfig?: Partial<FeesConfig> } | null)?.feesConfig ?? {};
  return {
    channelsText: typeof raw.channelsText === "string" ? raw.channelsText : "",
    confirmPhone: typeof raw.confirmPhone === "string" ? raw.confirmPhone : "",
    dueWeeks: Number.isFinite(raw.dueWeeks) && (raw.dueWeeks as number) > 0 ? (raw.dueWeeks as number) : 4,
    clearanceGate: raw.clearanceGate === "block" || raw.clearanceGate === "off" ? raw.clearanceGate : "warn",
  };
}

import { render } from "@/messaging/render";

export { SMS_COST_PESEWAS } from "@/lib/sms-cost";

/** When fee reminders last went out (schools.settings.feeRemindersSent). */
export function getRemindersSent(settings: unknown): { at: Date; n: number } | null {
  const raw = (settings as { feeRemindersSent?: { at?: string; n?: number } } | null)?.feeRemindersSent;
  if (!raw?.at) return null;
  const at = new Date(raw.at);
  return Number.isNaN(at.getTime()) ? null : { at, n: Number(raw.n ?? 0) };
}

/** The " — confirm payment numbers on …" tail every money SMS carries when the school set a number. */
export const confirmTail = (cfg: FeesConfig) =>
  cfg.confirmPhone ? ` — confirm payment numbers on ${cfg.confirmPhone}` : "";

/** The reminder text, exactly as the parent reads it — the confirm box shows this.
 *  Rendered from the same template notify() sends, so the two never drift. */
export function reminderBody(schoolName: string, cfg: FeesConfig, balancePesewas: number) {
  return render("reminder", { school: schoolName, amount: (balancePesewas / 100).toFixed(2), confirm: confirmTail(cfg) });
}

export const ghs = (p: number) =>
  `GHS ${(p / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
