import type { ModuleManifest } from "../types";
export const hrModule: ModuleManifest = {
  key: "hr", name: "Staff HR", description: "Leave tracking", icon: "Briefcase",
  nav: [{ label: "Staff HR", href: "/hr", roles: ["admin"] }],
  permissions: ["hr.manage"], dependsOn: ["core"],
};
