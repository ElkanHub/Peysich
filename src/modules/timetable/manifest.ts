import type { ModuleManifest } from "../types";
export const timetableModule: ModuleManifest = {
  key: "timetable", name: "Timetable", description: "Lesson scheduling with clash detection",
  icon: "CalendarDays",
  nav: [{ label: "Timetable", href: "/timetable", roles: ["admin", "teacher", "student", "parent"] }],
  permissions: ["timetable.edit"], dependsOn: ["core"],
};
