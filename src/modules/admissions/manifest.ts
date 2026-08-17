import type { ModuleManifest } from "../types";
export const admissionsModule: ModuleManifest = {
  key: "admissions", name: "Admissions", description: "Applicant pipeline to enrolment", icon: "UserPlus",
  nav: [{ label: "Admissions", href: "/admissions", roles: ["admin"] }],
  permissions: ["admissions.manage"], dependsOn: ["core"],
};
