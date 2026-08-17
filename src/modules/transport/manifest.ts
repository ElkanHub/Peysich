import type { ModuleManifest } from "../types";
export const transportModule: ModuleManifest = {
  key: "transport", name: "Transport", description: "Routes and pickup lists", icon: "Bus",
  nav: [{ label: "Transport", href: "/transport", roles: ["admin"] }],
  permissions: ["transport.manage"], dependsOn: ["core"],
};
