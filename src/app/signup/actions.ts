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

const schema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().refine(isValidSlug, "Invalid or reserved subdomain"),
  planKey: z.enum(["trial", "starter", "standard", "premium"]),
});

/** Self-serve: signed-up user creates their school and becomes its admin.
 *  Trial → straight in. Paid plan → checkout, fulfilled by webhook/fake-pay. */
export async function createMySchool(_: unknown, f: FormData) {
  const session = await getSession();
  if (!session) return { error: "Sign up first" };
  const u = session.user as { id: string; email: string; schoolId?: string | null };
  if (u.schoolId) return { error: "You already belong to a school" };
  const p = schema.safeParse(Object.fromEntries(f));
  if (!p.success) return { error: p.error.issues[0].message };
  const { name, slug, planKey } = p.data;
  const [dup] = await db.select({ id: schools.id }).from(schools).where(eq(schools.slug, slug));
  if (dup) return { error: "That subdomain is taken" };

  const id = uid();
  const trialEnds = new Date(); trialEnds.setDate(trialEnds.getDate() + 14);
  await db.insert(schools).values({ id, name, slug, planKey: "trial", status: "trial", trialEndsAt: trialEnds });
  await db.update(userTable).set({ role: "admin", schoolId: id }).where(eq(userTable.id, u.id));
  invalidateSchool(slug);

  if (planKey === "trial") return { ok: true, slug };

  const [plan] = await db.select().from(plans).where(eq(plans.key, planKey));
  const ref = `sub_${uid()}`;
  await db.insert(pendingCheckouts).values({ reference: ref, schoolId: id, planKey, cycle: "monthly" });
  const { checkoutUrl } = await initCheckout({
    email: u.email, amountPesewas: plan.pricePerMonthPesewas, reference: ref,
    callbackUrl: `/signup/done?slug=${slug}`, metadata: { schoolId: id, planKey, cycle: "monthly" },
  });
  return { ok: true, slug, checkoutUrl };
}

/** School-plane upgrade (billing page). Caller must be this school's admin. */
export async function startUpgrade(
  schoolId: string, planKey: string, email: string, cycle: "monthly" | "yearly" = "monthly",
) {
  const session = await getSession();
  const u = session?.user as { role: string; schoolId?: string | null } | undefined;
  if (!u || (u.schoolId !== schoolId && u.role !== "platform_admin") ||
      !["admin", "platform_admin"].includes(u.role)) return { error: "Forbidden" };
  const [plan] = await db.select().from(plans).where(eq(plans.key, planKey));
  if (!plan) return { error: "Unknown plan" };
  const ref = `sub_${uid()}`;
  await db.insert(pendingCheckouts).values({ reference: ref, schoolId, planKey, cycle });
  const { checkoutUrl } = await initCheckout({
    email, amountPesewas: cycle === "yearly" ? plan.pricePerYearPesewas : plan.pricePerMonthPesewas,
    reference: ref, callbackUrl: `/billing`, metadata: { schoolId, planKey, cycle },
  });
  return { checkoutUrl };
}
