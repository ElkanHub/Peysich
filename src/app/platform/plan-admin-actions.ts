"use server";
import { eq } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { planRequests, plans, platformAuditLogs, schools } from "@/db/schema";
import { getSession } from "@/core/session";
import { invalidateSchool } from "@/core/tenant";
import { ALL_MODULES } from "@/core/plan-const";
import { uid } from "@/lib/utils";

async function requirePlatformAdmin() {
  const session = await getSession();
  const u = session?.user as { id: string; role: string } | undefined;
  if (!u || u.role !== "platform_admin") throw new Error("Forbidden");
  return u;
}

async function audit(actorUserId: string, action: string, schoolId: string | null, detail: object) {
  await db.insert(platformAuditLogs).values({
    id: uid(), actorUserId, action, schoolId, detail: detail as Record<string, unknown>,
  });
}

/** Every plan touched here goes live everywhere at once: schools' Billing
 *  pages and the STATIC marketing pricing (revalidateTag regenerates it —
 *  no redeploy). */
async function republishPlans() {
  updateTag("plans");
  revalidatePath("/platform/plans");
  revalidatePath("/", "page"); // the marketing page itself
}

export async function savePlan(key: string, f: FormData) {
  const u = await requirePlatformAdmin();
  const [p] = await db.select().from(plans).where(eq(plans.key, key));
  if (!p) redirect("/platform/plans?flash=error");
  const monthly = Math.max(0, Math.round(Number(f.get("monthly") ?? 0) * 100));
  const yearly = Math.max(0, Math.round(Number(f.get("yearly") ?? 0) * 100));
  const capRaw = String(f.get("cap") ?? "").trim();
  const moduleKeys = ALL_MODULES.filter((k) => f.get(`m_${k}`) === "on");
  await db.update(plans).set({
    name: String(f.get("name") ?? p.name).trim() || p.name,
    pricePerMonthPesewas: monthly, pricePerYearPesewas: yearly,
    studentCap: capRaw ? Math.max(1, Number(capRaw)) : null,
    moduleKeys, isPublic: f.get("isPublic") === "on",
    active: f.get("active") !== "off",
  }).where(eq(plans.key, key));
  await audit(u.id, "plans.save", p.schoolId ?? null, { key, monthly, yearly, moduleKeys });
  await republishPlans();
  redirect("/platform/plans?flash=saved");
}

export async function setRequestStatus(id: string, status: string, f?: FormData) {
  const u = await requirePlatformAdmin();
  void f;
  if (!["new", "contacted", "negotiating", "approved", "declined", "closed"].includes(status))
    redirect("/platform/requests?flash=error");
  await db.update(planRequests).set({ status }).where(eq(planRequests.id, id));
  await audit(u.id, "planRequest.status", null, { id, status });
  revalidatePath("/platform/requests");
  redirect("/platform/requests?flash=saved");
}

/** Approve a custom ask: a PRIVATE plan is created (or updated), bound to
 *  that school, the school is moved onto it, and the request closes. The
 *  school's Billing page shows THEIR plan on the next load. */
export async function approveCustomRequest(id: string, f: FormData) {
  const u = await requirePlatformAdmin();
  const [r] = await db.select().from(planRequests).where(eq(planRequests.id, id));
  if (!r || r.kind !== "custom" || !r.schoolId) redirect("/platform/requests?flash=error");
  const monthly = Math.max(0, Math.round(Number(f.get("monthly") ?? 0) * 100));
  const yearly = Math.max(0, Math.round(Number(f.get("yearly") ?? 0) * 100));
  const capRaw = String(f.get("cap") ?? "").trim();
  const key = `custom-${r.schoolId}`;
  const values = {
    name: String(f.get("name") ?? "").trim() || `${r.schoolName ?? "Custom"} plan`,
    moduleKeys: ["attendance", "assessment", "comms", ...r.moduleKeys],
    studentCap: capRaw ? Math.max(1, Number(capRaw)) : null,
    pricePerMonthPesewas: monthly, pricePerYearPesewas: yearly,
    active: true, isPublic: false, schoolId: r.schoolId,
  };
  const [existing] = await db.select().from(plans).where(eq(plans.key, key));
  if (existing) await db.update(plans).set(values).where(eq(plans.key, key));
  else await db.insert(plans).values({ key, ...values });
  await db.update(schools).set({ planKey: key, updatedAt: new Date() }).where(eq(schools.id, r.schoolId));
  await db.update(planRequests).set({ status: "approved" }).where(eq(planRequests.id, id));
  const [sch] = await db.select({ slug: schools.slug }).from(schools).where(eq(schools.id, r.schoolId));
  if (sch) invalidateSchool(sch.slug);
  await audit(u.id, "planRequest.approve", r.schoolId, { id, key, monthly, yearly });
  await republishPlans();
  redirect("/platform/requests?flash=saved");
}
