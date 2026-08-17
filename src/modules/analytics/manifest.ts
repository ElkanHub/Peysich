import type { ModuleManifest } from "../types";
export const analyticsModule: ModuleManifest = {
  key: "analytics", name: "Analytics", description: "Cross-module insight", icon: "BarChart3",
  nav: [{ label: "Analytics", href: "/analytics", roles: ["admin"] }],
  permissions: ["analytics.manage"], dependsOn: ["attendance", "assessment", "fees"],
};
