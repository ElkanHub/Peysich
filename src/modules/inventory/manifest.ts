import type { ModuleManifest } from "../types";
export const inventoryModule: ModuleManifest = {
  key: "inventory", name: "Inventory", description: "School assets and supplies", icon: "Boxes",
  nav: [{ label: "Inventory", href: "/inventory", roles: ["admin"] }],
  permissions: ["inventory.manage"], dependsOn: ["core"],
};
