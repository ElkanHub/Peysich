import { unstable_cache } from "next/cache";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { plans } from "@/db/schema";

export type PublicPlanRow = {
  key: string; name: string; moduleKeys: string[]; studentCap: number | null;
  pricePerTermPesewas: number; pricePerYearPesewas: number;
};

/* If the database is unreachable — or a migration hasn't landed yet — the
 * marketing page must still BUILD and show correct pricing. These mirror
 * the seeded plans; the live query replaces them the moment it works. */
const FALLBACK_PLANS: PublicPlanRow[] = [
  { key: "starter", name: "Starter", moduleKeys: ["attendance", "assessment", "comms"], studentCap: 200, pricePerTermPesewas: 50000, pricePerYearPesewas: 125000 },
  { key: "standard", name: "Standard", moduleKeys: ["attendance", "assessment", "comms", "timetable", "homework", "fees"], studentCap: 600, pricePerTermPesewas: 100000, pricePerYearPesewas: 250000 },
  { key: "premium", name: "Premium", moduleKeys: ["attendance", "assessment", "comms", "timetable", "homework", "fees", "admissions", "library", "transport", "inventory", "hr", "analytics"], studentCap: null, pricePerTermPesewas: 200000, pricePerYearPesewas: 500000 },
];

/** The public plans, cached under the "plans" tag. The marketing page reads
 *  this, so it STAYS a static page — and the moment the platform console
 *  saves a plan it revalidates the tag and the public pricing regenerates.
 *  No redeploy, no per-visit rendering — and never a broken build. */
export const getPublicPlans = unstable_cache(
  async (): Promise<PublicPlanRow[]> => {
    try {
      const rows = await db.select().from(plans)
        .where(and(eq(plans.active, true), eq(plans.isPublic, true)))
        .orderBy(asc(plans.pricePerTermPesewas));
      return rows.length ? rows : FALLBACK_PLANS;
    } catch (e) {
      console.error("getPublicPlans fell back to seeded pricing:", e);
      return FALLBACK_PLANS;
    }
  },
  ["public-plans"],
  { tags: ["plans"], revalidate: 3600 },
);
