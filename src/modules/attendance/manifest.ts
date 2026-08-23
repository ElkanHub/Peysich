import type { ModuleManifest } from "../types";

export const attendanceModule: ModuleManifest = {
  key: "attendance",
  name: "Attendance",
  description: "Daily register with parent alerts",
  icon: "CalendarCheck",
  nav: [{ label: "Attendance", href: "/attendance", roles: ["admin", "teacher", "student", "parent"] }],
  permissions: ["attendance.view", "attendance.mark"],
  dependsOn: ["core"],
};
