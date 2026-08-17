import type { ModuleManifest } from "../types";
export const commsModule: ModuleManifest = {
  key: "comms", name: "Communication", description: "Announcements, events, SMS",
  icon: "Megaphone",
  nav: [{ label: "Announcements", href: "/comms", roles: ["admin", "teacher", "student", "parent"] }],
  permissions: ["comms.post", "comms.sms"], dependsOn: ["core"],
};
