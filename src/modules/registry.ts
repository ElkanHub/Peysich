import type { ModuleManifest } from "./types";

// ⭐ The single registration point. Adding a module = one import + one line.
// Manifests must stay serializable-light (no heavy imports) — middleware reads route maps.

const manifests: ModuleManifest[] = [
  // Phase 2+: attendanceModule, assessmentModule, ...
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
