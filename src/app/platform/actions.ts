"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { platformAuditLogs, schoolModules, schools, plans } from "@/db/schema";
import { getSession } from "@/core/session";
import { invalidateModules } from "@/core/entitlements";
import { isValidSlug, invalidateSchool } from "@/core/tenant";
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

const createSchoolSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().refine(isValidSlug, "Invalid or reserved slug"),
  planKey: z.enum(["trial", "starter", "standard", "premium"]),
});

export async function createSchool(_: unknown, formData: FormData) {
  const u = await requirePlatformAdmin();
  const parsed = createSchoolSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, slug, planKey } = parsed.data;
  const [dup] = await db.select({ id: schools.id }).from(schools).where(eq(schools.slug, slug));
  if (dup) return { error: "Slug already taken" };
  const id = uid();
  await db.insert(schools).values({ id, name, slug, planKey, status: "active" });
  await audit(u.id, "school.create", id, { name, slug, planKey });
  invalidateSchool(slug);
  redirect(`/platform/schools/${id}`);
}

/** Switchboard: mode = "default" removes the override row; "on"/"off" upserts it. */
export async function setModuleMode(schoolId: string, moduleKey: string, mode: string) {
  const u = await requirePlatformAdmin();
  if (mode === "default") {
    await db.delete(schoolModules).where(and(
      eq(schoolModules.schoolId, schoolId), eq(schoolModules.moduleKey, moduleKey)));
  } else if (mode === "on" || mode === "off") {
    await db.insert(schoolModules)
      .values({ schoolId, moduleKey, mode, updatedBy: u.id })
      .onConflictDoUpdate({
        target: [schoolModules.schoolId, schoolModules.moduleKey],
        set: { mode, updatedBy: u.id, updatedAt: new Date() },
      });
  } else return;
  await audit(u.id, "switchboard.set", schoolId, { moduleKey, mode });
  invalidateModules(schoolId);
  revalidatePath(`/platform/schools/${schoolId}`);
}

export async function setSchoolStatus(schoolId: string, status: "active" | "suspended") {
  const u = await requirePlatformAdmin();
  await db.update(schools).set({ status, updatedAt: new Date() }).where(eq(schools.id, schoolId));
  await audit(u.id, `school.${status === "active" ? "reactivate" : "suspend"}`, schoolId, {});
  revalidatePath(`/platform/schools/${schoolId}`);
}

/** Custom plan composer: per-school module set + price + cap → plan "custom-<slug>". */
export async function setCustomPlan(schoolId: string, f: FormData) {
  const u = await requirePlatformAdmin();
  const [school] = await db.select().from(schools).where(eq(schools.id, schoolId));
  if (!school) return;
  const moduleKeys: string[] = [];
  for (const [k] of f.entries()) if (k.startsWith("m_")) moduleKeys.push(k.slice(2));
  const price = Math.round(Number(f.get("priceGhs")) * 100) || 0;
  const cap = Number(f.get("studentCap")) || null;
  const key = `custom-${school.slug}`;
  await db.insert(plans)
    .values({ key, name: `Custom (${school.name})`, moduleKeys, studentCap: cap, pricePerTermPesewas: price })
    .onConflictDoUpdate({ target: [plans.key],
      set: { moduleKeys, studentCap: cap, pricePerTermPesewas: price } });
  await db.update(schools).set({ planKey: key, studentCap: cap ?? 100000, updatedAt: new Date() })
    .where(eq(schools.id, schoolId));
  await audit(u.id, "plan.custom", schoolId, { moduleKeys, price, cap });
  invalidateModules(schoolId);
  revalidatePath(`/platform/schools/${schoolId}`);
}

export async function extendTrial(schoolId: string, days: number) {
  const u = await requirePlatformAdmin();
  const [s] = await db.select().from(schools).where(eq(schools.id, schoolId));
  if (!s) return;
  const base = s.trialEndsAt && s.trialEndsAt > new Date() ? s.trialEndsAt : new Date();
  const ends = new Date(base); ends.setDate(ends.getDate() + days);
  await db.update(schools).set({ trialEndsAt: ends, status: "trial", updatedAt: new Date() })
    .where(eq(schools.id, schoolId));
  await audit(u.id, "trial.extend", schoolId, { days });
  revalidatePath("/platform/subscriptions");
}

/** Edit a standard plan's price/caps (plans are data — doc 04). */
export async function updatePlan(planKey: string, f: FormData) {
  const u = await requirePlatformAdmin();
  await db.update(plans).set({
    pricePerTermPesewas: Math.round(Number(f.get("priceGhs")) * 100) || 0,
    studentCap: Number(f.get("studentCap")) || null,
  }).where(eq(plans.key, planKey));
  await audit(u.id, "plan.update", null, { planKey });
  revalidatePath("/platform/settings");
}

export async function setLeadStatus(id: string, status: string, f?: FormData) {
  const u = await requirePlatformAdmin();
  const { leads } = await import("@/db/schema");
  await db.update(leads).set({ status, note: f ? String(f.get("note") || "") || null : undefined })
    .where(eq(leads.id, id));
  await audit(u.id, "lead.status", null, { id, status });
  revalidatePath("/platform/leads");
}

/** Broadcast to every active school: lands as a school-wide announcement. */
export async function sendBroadcast(f: FormData) {
  const u = await requirePlatformAdmin();
  const { announcements, platformBroadcasts } = await import("@/db/schema");
  const title = String(f.get("title")), body = String(f.get("body"));
  if (!title || !body) return;
  const targets = await db.select().from(schools);
  const active = targets.filter((s) => ["active", "trial", "past_due"].includes(s.status));
  await db.insert(announcements).values(active.map((s) => ({
    id: uid(), schoolId: s.id, title, body, classId: null, createdBy: u.id,
  })));
  await db.insert(platformBroadcasts).values({
    id: uid(), title, body, sentBy: u.id, schoolsReached: active.length,
  });
  await audit(u.id, "broadcast.send", null, { title, reached: active.length });
  revalidatePath("/platform/broadcast");
}

/** Invite another platform admin (login shown once). */
export async function invitePlatformAdmin(_: unknown, f: FormData) {
  const u = await requirePlatformAdmin();
  const { createSchoolLogin } = await import("@/core/accounts");
  const email = String(f.get("email")).trim();
  const name = String(f.get("name")).trim();
  if (!email || !name) return { error: "Name and email required" };
  const r = await createSchoolLogin({
    schoolId: null, schoolSlug: "platform", name, role: "admin", email,
    username: email.split("@")[0],
  });
  if ("error" in r) return { error: r.error };
  const { user: userTable } = await import("@/db/schema");
  await db.update(userTable).set({ role: "platform_admin", schoolId: null })
    .where(eq(userTable.id, r.userId));
  await audit(u.id, "platform.invite", null, { email });
  return { loginAs: r.loginAs, password: r.password };
}
