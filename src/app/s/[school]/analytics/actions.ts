"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireModule, getCurrentTerm } from "@/core/school-context";
import { getSnapshot } from "@/modules/analytics/compute";

/** "Refresh now" — recompute today's snapshot on demand. */
export async function refreshSnapshot(slug: string, tab: string) {
  const { school } = await requireModule(slug, "analytics", ["admin"]);
  const term = await getCurrentTerm(school.id);
  await getSnapshot(school, term, true);
  revalidatePath(`/analytics`);
  redirect(tab ? `/analytics?tab=${tab}&flash=done` : `/analytics?flash=done`);
}
