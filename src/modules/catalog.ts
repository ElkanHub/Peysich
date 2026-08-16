/** Sales catalog (doc 03): every sellable module key, whether or not its code
 *  has shipped yet. Drives plans + switchboard. Registry = shipped code. */
export const MODULE_CATALOG: { key: string; name: string; dependsOn?: string[] }[] = [
  { key: "attendance", name: "Attendance" },
  { key: "assessment", name: "Exams & Report Cards" },
  { key: "comms", name: "Communication" },
  { key: "timetable", name: "Timetable" },
  { key: "homework", name: "Homework & Assignments", dependsOn: ["assessment"] },
  { key: "fees", name: "Fees & Billing" },
  { key: "admissions", name: "Admissions" },
  { key: "library", name: "Library" },
  { key: "transport", name: "Transport" },
  { key: "inventory", name: "Inventory & Assets" },
  { key: "hr", name: "Staff HR" },
  { key: "analytics", name: "Advanced Analytics", dependsOn: ["attendance", "assessment", "fees"] },
];
