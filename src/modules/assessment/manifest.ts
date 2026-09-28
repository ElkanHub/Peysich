import type { ModuleManifest } from "../types";

export const assessmentModule: ModuleManifest = {
  key: "assessment",
  name: "Exams & Report Cards",
  description: "CA + exams, grading, terminal report cards",
  icon: "GraduationCap",
  nav: [
    { label: "Scores", href: "/assessment", roles: ["admin", "teacher"] },
    { label: "Report cards", href: "/reports", roles: ["admin"] },
  ],
  permissions: ["assessment.enter", "assessment.publish"],
  dependsOn: ["core"],
};
