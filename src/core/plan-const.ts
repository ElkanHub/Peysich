/* One source of truth for how plans are DESCRIBED and how a custom plan is
 * ESTIMATED — shared by the school's Billing page, the public marketing
 * builder and the platform console, so no two surfaces can disagree. */

export const MODULE_LABELS: Record<string, string> = {
  attendance: "Attendance & register book",
  assessment: "Assessment & report cards",
  comms: "Announcements & SMS",
  timetable: "Timetable & allocations",
  homework: "Homework",
  fees: "Fees, invoices & receipts",
  admissions: "Admissions pipeline",
  analytics: "Analytics",
  library: "Library",
  transport: "Transport",
  inventory: "Inventory",
  hr: "Staff HR & leave",
};
export const ALL_MODULES = Object.keys(MODULE_LABELS);

/** Every SchoolSpec school runs on the core — it is never optional. */
export const CORE_MODULES = ["attendance", "assessment", "comms"];
export const ADDON_MODULES = ALL_MODULES.filter((k) => !CORE_MODULES.includes(k));

/* The custom-plan estimate, PER TERM: a starting point, never a bill. Base
 * covers the core; each add-on and the size band add to it. */
export const BASE_PESEWAS = 50000;
export const ADDON_PRICES: Record<string, number> = {
  timetable: 24000, homework: 16000, fees: 36000, admissions: 28000,
  analytics: 32000, library: 14000, transport: 14000, inventory: 14000, hr: 18000,
};
export const SIZE_BANDS: { key: string; label: string; addPesewas: number }[] = [
  { key: "s200", label: "Up to 200", addPesewas: 0 },
  { key: "s600", label: "200 – 600", addPesewas: 16000 },
  { key: "s1500", label: "600 – 1,500", addPesewas: 36000 },
  { key: "s1500p", label: "1,500+", addPesewas: 56000 },
];

/* How schools pay: by the term or by the academic year, counted from the day
 * of payment. A term payment covers four months — the term and the holiday
 * after it — so three of them cover the year with no gap. */
export type Cycle = "term" | "year";
export const CYCLE_MONTHS: Record<Cycle, number> = { term: 4, year: 12 };
export const CYCLE_WORDS: Record<Cycle, string> = { term: "term", year: "academic year" };
/** Rows written before terms said monthly|yearly. */
export const asCycle = (c: unknown): Cycle => c === "year" || c === "yearly" ? "year" : "term";
/** An academic year is priced as two and a half terms. */
export const yearFromTerm = (termPesewas: number) => Math.round(termPesewas * 2.5);

export function estimatePesewas(moduleKeys: string[], sizeBand: string) {
  const band = SIZE_BANDS.find((b) => b.key === sizeBand);
  return BASE_PESEWAS + (band?.addPesewas ?? 0)
    + moduleKeys.reduce((sum, k) => sum + (ADDON_PRICES[k] ?? 0), 0);
}

export const ghsPlan = (pesewas: number) => `GHS ${(pesewas / 100).toLocaleString()}`;
