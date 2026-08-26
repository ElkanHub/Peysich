/* Team & access — the pure vocabulary, shared by server and client code.
 * (The db-touching helpers live in core/access.ts.) */

export type FeeActionKey = "record" | "voidPay" | "catalog" | "generate";

/** Every grantable tab, in sidebar order. Key = first path segment. */
export const TAB_KEYS: { key: string; label: string }[] = [
  { key: "students", label: "Students" },
  { key: "guardians", label: "Guardians" },
  { key: "staff", label: "Staff" },
  { key: "settings", label: "Settings" },
  { key: "billing", label: "Billing" },
  { key: "attendance", label: "Attendance" },
  { key: "assessment", label: "Assessment" },
  { key: "reports", label: "Reports" },
  { key: "timetable", label: "Timetable" },
  { key: "homework", label: "Homework" },
  { key: "comms", label: "Announcements" },
  { key: "calendar", label: "Calendar" },
  { key: "fees", label: "Fees" },
  { key: "admissions", label: "Admissions" },
  { key: "library", label: "Library" },
  { key: "transport", label: "Transport" },
  { key: "inventory", label: "Inventory" },
  { key: "hr", label: "Staff HR" },
  { key: "analytics", label: "Analytics" },
];

export const FEE_ACTION_LABELS: Record<FeeActionKey, string> = {
  record: "Record payments (cashier)",
  voidPay: "Void payments",
  catalog: "Edit the fee catalog & settings",
  generate: "Generate term invoices",
};

/** One-click starting points — stored as plain grants, always editable. */
export const ACCESS_PRESETS: Record<string, { label: string; tabs: string[]; fees: Partial<Record<FeeActionKey, boolean>> }> = {
  cashier: { label: "Cashier", tabs: ["fees"], fees: { record: true } },
  bursar: { label: "Bursar", tabs: ["fees", "students", "guardians"], fees: { record: true, voidPay: true, catalog: true, generate: true } },
  registrar: { label: "Registrar", tabs: ["students", "guardians", "admissions", "attendance"], fees: {} },
  academic: { label: "Academic head", tabs: ["students", "attendance", "assessment", "reports", "timetable", "homework", "comms", "calendar"], fees: {} },
};
