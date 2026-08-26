/** Intake settings (schools.settings.intake) — one place, read by the
 *  admissions desk, every applicant file, and analytics' seats math. */
export type IntakeDoc = { key: string; label: string; note: string };

export type IntakeConfig = {
  /** Are applications being accepted right now? */
  open: boolean;
  /** Optional close date shown on the desk ("applications close …"). */
  closesOn: string;
  /** Seats per level for the intake year: levelId → capacity. */
  seats: Record<string, number>;
  /** Documents collected per applicant (checklist on the file). */
  docs: IntakeDoc[];
  /** Entrance test, recorded as a score out of testMax; cut-off is advisory. */
  testRequired: boolean;
  testMax: number;
  testCutoff: number;
};

export const INTAKE_DEFAULT_DOCS: IntakeDoc[] = [
  { key: "birth", label: "Birth certificate", note: "all levels" },
  { key: "immun", label: "Immunization card", note: "Creche–KG" },
  { key: "photo", label: "Passport photo", note: "all levels" },
  { key: "report", label: "Previous report card", note: "B2 and above" },
];

export const INTAKE_DEFAULTS: IntakeConfig = {
  open: true, closesOn: "", seats: {},
  docs: INTAKE_DEFAULT_DOCS,
  testRequired: false, testMax: 100, testCutoff: 50,
};

export function getIntakeConfig(settings: unknown): IntakeConfig {
  const raw = (settings as { intake?: Partial<IntakeConfig> } | null)?.intake ?? {};
  const docs = Array.isArray(raw.docs)
    ? raw.docs.filter((d): d is IntakeDoc => Boolean(d && d.key && d.label))
    : INTAKE_DEFAULT_DOCS;
  return {
    open: raw.open !== false,
    closesOn: typeof raw.closesOn === "string" ? raw.closesOn : "",
    seats: raw.seats && typeof raw.seats === "object" ? (raw.seats as Record<string, number>) : {},
    docs,
    testRequired: raw.testRequired === true,
    testMax: Number.isFinite(raw.testMax) && (raw.testMax as number) > 0 ? (raw.testMax as number) : 100,
    testCutoff: Number.isFinite(raw.testCutoff) ? (raw.testCutoff as number) : 50,
  };
}

/** Parse the applicant's received-documents JSON safely. */
export function parseDocs(raw: string | null): Record<string, boolean> {
  try { const o = JSON.parse(raw || "{}"); return o && typeof o === "object" ? o : {}; }
  catch { return {}; }
}

export const STAGES = ["new", "screening", "offer", "admitted"] as const;
export const STAGE_LABEL: Record<string, string> = {
  new: "New", screening: "Screening", offer: "Offer", admitted: "Admitted",
  waitlist: "Waitlisted", rejected: "Rejected",
};
