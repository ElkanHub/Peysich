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

/** Every Peysich school runs on the core — it is never optional. */
export const CORE_MODULES = ["attendance", "assessment", "comms"];
export const ADDON_MODULES = ALL_MODULES.filter((k) => !CORE_MODULES.includes(k));

/* The custom-plan estimate: a starting point, never a bill. Base covers the
 * core; each add-on and the size band add to it; yearly = 10 months. */
export const BASE_PESEWAS = 9900;
export const ADDON_PRICES: Record<string, number> = {
  timetable: 6000, homework: 4000, fees: 9000, admissions: 7000,
  analytics: 8000, library: 3500, transport: 3500, inventory: 3500, hr: 4500,
};
export const SIZE_BANDS: { key: string; label: string; addPesewas: number }[] = [
  { key: "s200", label: "Up to 200", addPesewas: 0 },
  { key: "s600", label: "200 – 600", addPesewas: 4000 },
  { key: "s1500", label: "600 – 1,500", addPesewas: 9000 },
  { key: "s1500p", label: "1,500+", addPesewas: 14000 },
];

export function estimatePesewas(moduleKeys: string[], sizeBand: string) {
  const band = SIZE_BANDS.find((b) => b.key === sizeBand);
  return BASE_PESEWAS + (band?.addPesewas ?? 0)
    + moduleKeys.reduce((sum, k) => sum + (ADDON_PRICES[k] ?? 0), 0);
}

export const ghsPlan = (pesewas: number) => `GHS ${(pesewas / 100).toLocaleString()}`;
