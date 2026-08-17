import type { ModuleManifest } from "../types";
export const feesModule: ModuleManifest = {
  key: "fees", name: "Fees & Billing", description: "Fee structures, invoices, MoMo collection",
  icon: "Wallet",
  nav: [{ label: "Fees", href: "/fees", roles: ["admin"] }],
  permissions: ["fees.manage", "fees.record"], dependsOn: ["core"],
};
