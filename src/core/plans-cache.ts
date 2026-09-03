import { unstable_cache } from "next/cache";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { plans } from "@/db/schema";

/** The public plans, cached under the "plans" tag. The marketing page reads
 *  this, so it STAYS a static page — and the moment the platform console
 *  saves a plan it calls revalidateTag("plans") and the public pricing
 *  regenerates within a minute. No redeploy, no per-visit rendering. */
export const getPublicPlans = unstable_cache(
  async () =>
    db.select().from(plans)
      .where(and(eq(plans.active, true), eq(plans.isPublic, true)))
      .orderBy(asc(plans.pricePerMonthPesewas)),
  ["public-plans"],
  { tags: ["plans"] },
);
