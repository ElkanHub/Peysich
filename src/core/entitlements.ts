import { eq } from "drizzle-orm";
import { unstable_cache, revalidateTag } from "next/cache";
import { db } from "@/db";
import { plans, schoolModules, schools } from "@/db/schema";
import { registry } from "@/modules/registry";

const CORE_KEYS = ["core"]; // always on

/**
 * Effective module set = plan modules + switchboard force-on − force-off,
 * minus modules with unmet dependencies. Cached per school; invalidated on
 * any plan/switchboard change via revalidateTag(`modules:${schoolId}`).
 */
const getEnabledModuleKeys = (schoolId: string) =>
  unstable_cache(
    // NOTE: unstable_cache JSON-serializes — must return an array, never a Set
    async (): Promise<string[]> => {
      const [school] = await db.select().from(schools).where(eq(schools.id, schoolId));
      if (!school) return [];
      const [plan] = await db.select().from(plans).where(eq(plans.key, school.planKey));
      const set = new Set<string>([...CORE_KEYS, ...(plan?.moduleKeys ?? [])]);
      const overrides = await db.select().from(schoolModules)
        .where(eq(schoolModules.schoolId, schoolId));
      for (const o of overrides) o.mode === "on" ? set.add(o.moduleKey) : set.delete(o.moduleKey);
      // drop modules with unmet dependencies
      for (const key of [...set]) {
        const m = registry.get(key);
        if (m && !m.dependsOn.every((d) => d === "core" || set.has(d))) set.delete(key);
      }
      return [...set];
    },
    [`modules-${schoolId}`],
    { tags: [`modules:${schoolId}`], revalidate: 300 },
  )();

export const getEnabledModules = async (schoolId: string) =>
  new Set(await getEnabledModuleKeys(schoolId));

export const isEnabled = async (schoolId: string, moduleKey: string) =>
  moduleKey === "core" || (await getEnabledModules(schoolId)).has(moduleKey);

export const invalidateModules = (schoolId: string) => {
  try { revalidateTag(`modules:${schoolId}`, "max"); } catch { /* outside request context (scripts) */ }
};
