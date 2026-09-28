// Server-safe (no "use client"): the settings page calls this while rendering.
import { ACCESS_PRESETS, FEE_ACTION_LABELS } from "@/core/access-const";

/** Which preset a saved grant matches, if any ("custom" otherwise). */
export function presetOf(g: { tabs: string[]; fees: Record<string, boolean | undefined> } | null | undefined) {
  if (!g) return "full";
  for (const [k, p] of Object.entries(ACCESS_PRESETS)) {
    const sameTabs = p.tabs.length === g.tabs.length && p.tabs.every((t) => g.tabs.includes(t));
    const sameFees = Object.keys(FEE_ACTION_LABELS).every((f) => !!p.fees[f as keyof typeof p.fees] === !!g.fees[f]);
    if (sameTabs && sameFees) return k;
  }
  return "custom";
}
