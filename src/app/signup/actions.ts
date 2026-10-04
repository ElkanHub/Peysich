"use server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { schools, user as userTable, plans } from "@/db/schema";
import { getSession } from "@/core/session";
import { isValidSlug, invalidateSchool } from "@/core/tenant";
import { initCheckout } from "@/lib/paystack";
import { pendingCheckouts } from "@/db/schema";
import { uid } from "@/lib/utils";
import { asCycle, type Cycle } from "@/core/plan-const";
import { grantStartingCredit } from "@/messaging/wallet";

const schema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().refine(isValidSlug, "That link is taken or not allowed — try another"),
  ownerPhone: z.string().trim().regex(/^[+0-9][0-9 ]{8,16}$/, "Type your WhatsApp number, e.g. 024 000 0000"),
});

/** Self-serve: signed-up user creates their school and becomes its admin.
 *  Always on the free trial — the plan question lives in Billing (startUpgrade). */
export async function createMySchool(_: unknown, f: FormData) {
  const session = await getSession();
  if (!session) return { error: "Sign up first" };
  const u = session.user as { id: string; email: string; schoolId?: string | null };
  if (u.schoolId) return { error: "You already belong to a school" };
  const p = schema.safeParse(Object.fromEntries(f));
  if (!p.success) return { error: p.error.issues[0].message };
  const { name, slug, ownerPhone } = p.data;
  const [dup] = await db.select({ id: schools.id }).from(schools).where(eq(schools.slug, slug));
  if (dup) return { error: "That link is already taken — try another" };

  const id = uid();
  const trialEnds = new Date(); trialEnds.setDate(trialEnds.getDate() + 14);
  await db.insert(schools).values({ id, name, slug, planKey: "trial", status: "trial", trialEndsAt: trialEnds, ownerPhone });
  await db.update(userTable).set({ role: "admin", schoolId: id }).where(eq(userTable.id, u.id));
  await grantStartingCredit(id);
  invalidateSchool(slug);
  const { onSignUp } = await import("@/messaging/platform");
  await onSignUp(id);
  return { ok: true, slug };
}

/** School-plane upgrade (billing page). Caller must be this school's admin. */
export async function startUpgrade(
  schoolId: string, planKey: string, email: string, cycleRaw: Cycle = "term",
) {
  const cycle = asCycle(cycleRaw);
  const session = await getSession();
  const u = session?.user as { role: string; schoolId?: string | null } | undefined;
  if (!u || (u.schoolId !== schoolId && u.role !== "platform_admin") ||
      !["admin", "platform_admin"].includes(u.role)) return { error: "Forbidden" };
  const [plan] = await db.select().from(plans).where(eq(plans.key, planKey));
  if (!plan) return { error: "Unknown plan" };
  const ref = `sub_${uid()}`;
  // the same rules fulfilment uses: a renewal stacks, a plan change is credited
  const { applySubscription, quotePlan } = await import("@/core/billing");
  const q = await quotePlan(schoolId, plan, cycle);
  if (q.chargePesewas < 100) {
    // the credit from the old plan covers it: nothing to pay, so no checkout
    await applySubscription(schoolId, planKey, ref, cycle);
    return { checkoutUrl: "/billing" };
  }
  await db.insert(pendingCheckouts).values({ reference: ref, schoolId, planKey, cycle });
  const { checkoutUrl } = await initCheckout({
    email, amountPesewas: q.chargePesewas,
    reference: ref, callbackUrl: `/billing`, metadata: { schoolId, planKey, cycle },
  });
  return { checkoutUrl };
}
