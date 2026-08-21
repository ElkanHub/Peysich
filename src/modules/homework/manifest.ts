import type { ModuleManifest } from "../types";
export const homeworkModule: ModuleManifest = {
  key: "homework", name: "Homework & Assignments", description: "Assignments, submissions, marking",
  icon: "BookOpen",
  nav: [{ label: "Homework", href: "/homework", roles: ["admin", "teacher", "student", "parent"] }],
  permissions: ["homework.create", "homework.mark"], dependsOn: ["assessment"],
};
