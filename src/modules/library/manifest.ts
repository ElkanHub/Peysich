import type { ModuleManifest } from "../types";
export const libraryModule: ModuleManifest = {
  key: "library", name: "Library", description: "Catalogue and lending", icon: "Library",
  nav: [{ label: "Library", href: "/library", roles: ["admin", "teacher"] }],
  permissions: ["library.manage"], dependsOn: ["core"],
};
