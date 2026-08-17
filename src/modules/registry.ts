import type { ModuleManifest } from "./types";
import { attendanceModule } from "./attendance/manifest";
import { assessmentModule } from "./assessment/manifest";

// ⭐ The single registration point. Adding a module = one import + one line.

const manifests: ModuleManifest[] = [
  attendanceModule,
  assessmentModule,
];

export const registry = new Map(manifests.map((m) => [m.key, m]));

export const allModuleKeys = () => [...registry.keys()];

/** Route-prefix → module key map, used by middleware to gate URLs. */
export const routeModuleMap = (): Record<string, string> => {
  const map: Record<string, string> = {};
  for (const m of registry.values())
    for (const n of m.nav) map[n.href.split("/")[1]] = m.key;
  return map;
};
