import type { ModuleManifest } from "../types";
export const feesModule: ModuleManifest = {
  key: "fees", name: "Fees & Billing", description: "Fee catalog, invoices, receipts, ledger",
  icon: "Wallet",
  nav: [{ label: "Fees", href: "/fees", roles: ["admin", "parent"] }],
  permissions: ["fees.manage", "fees.record"], dependsOn: ["core"],
};
