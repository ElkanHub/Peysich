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

export const ghs = (p: number) =>
  `GHS ${(p / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
