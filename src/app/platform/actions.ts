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
import { yearFromTerm } from "@/core/plan-const";
import { grantStartingCredit } from "@/messaging/wallet";
import { withFlash } from "@/lib/flash";

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
  await grantStartingCredit(id);
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
  const price = Math.round(Number(f.get("priceGhs")) * 100) || 0; // GHS per term
  const priceYear = Math.round(Number(f.get("priceYearGhs")) * 100) || yearFromTerm(price);
  const cap = Number(f.get("studentCap")) || null;
  const key = `custom-${school.slug}`;
  await db.insert(plans)
    .values({ key, name: `Custom (${school.name})`, moduleKeys, studentCap: cap,
      pricePerTermPesewas: price, pricePerYearPesewas: priceYear })
    .onConflictDoUpdate({ target: [plans.key],
      set: { moduleKeys, studentCap: cap, pricePerTermPesewas: price, pricePerYearPesewas: priceYear } });
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
    pricePerTermPesewas: Math.round(Number(f.get("priceTermGhs")) * 100) || 0,
    pricePerYearPesewas: Math.round(Number(f.get("priceYearGhs")) * 100) || 0,
    installFeePesewas: Math.round(Number(f.get("installFeeGhs")) * 100) || 0,
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
  revalidatePath("/platform/schools");
}

/** Tie a lead to the school it became (or clear the tie). */
export async function linkLeadToSchool(id: string, f: FormData) {
  const u = await requirePlatformAdmin();
  const { leads } = await import("@/db/schema");
  const schoolId = String(f.get("schoolId") || "") || null;
  await db.update(leads).set({ schoolId, ...(schoolId ? { status: "converted" } : {}) }).where(eq(leads.id, id));
  await audit(u.id, "lead.link", schoolId, { id });
  revalidatePath("/platform/schools");
}

/** Broadcast (docs/12 §3.8). A notice lands as an announcement in each
 *  chosen school and pings the chosen roles through the one door; a promo is
 *  stored and takes the screen on the next open (ui/promo-gate.tsx). */
export async function sendBroadcast(f: FormData) {
  const u = await requirePlatformAdmin();
  const { announcements, platformBroadcasts, staff, studentGuardians, guardians, students } = await import("@/db/schema");
  const title = String(f.get("title") ?? "").trim(), body = String(f.get("body") ?? "").trim();
  if (!title || !body) return;
  const kind = f.get("kind") === "promo" ? "promo" : "notice";
  const roles = (f.getAll("roles") as string[]).filter((r) => ["admin", "teacher", "parent", "student"].includes(r));
  const chosen = f.get("scope") === "some" ? (f.getAll("schoolIds") as string[]) : null;
  const all = await db.select().from(schools);
  const targets = all.filter((s) => ["active", "trial", "past_due"].includes(s.status) && (!chosen || chosen.includes(s.id)));
  const day = (v: FormDataEntryValue | null) => v && /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? new Date(String(v) + "T00:00:00Z") : null;
  await db.insert(platformBroadcasts).values({
    id: uid(), title, body, sentBy: u.id, schoolsReached: targets.length, kind, roles: roles.length ? roles : ["admin"], schoolIds: chosen,
    ctaLabel: String(f.get("ctaLabel") ?? "") || null, ctaUrl: String(f.get("ctaUrl") ?? "") || null, imageUrl: String(f.get("imageUrl") ?? "") || null,
    startsAt: day(f.get("startsAt")), endsAt: day(f.get("endsAt")), everyHours: Math.max(1, Number(f.get("everyHours")) || 24),
  });
  if (kind === "notice") {
    // the feed, in every chosen school
    await db.insert(announcements).values(targets.map((s) => ({ id: uid(), schoolId: s.id, title, body, classId: null, createdBy: u.id })));
    // the pings: staff rows for admins and teachers, guardians for parents (students get the feed and the app badge)
    const { notifyMany } = await import("@/messaging/notify");
    const { eq: eqq, inArray: inn } = await import("drizzle-orm");
    for (const s of targets) {
      const rows: Parameters<typeof notifyMany>[1] = [];
      if (roles.includes("admin") || roles.includes("teacher")) {
        const st = await db.select({ id: staff.id, role: staff.staffRole }).from(staff).where(eqq(staff.schoolId, s.id));
        for (const x of st) if ((roles.includes("teacher") && x.role === "teacher") || (roles.includes("admin") && x.role !== "teacher"))
          rows.push({ to: { kind: "staff", id: x.id }, kind: "announcement_ping", vars: { title }, url: "/comms", fullText: body });
      }
      if (roles.includes("parent")) {
        const kids = await db.select({ id: students.id }).from(students).where(eqq(students.schoolId, s.id));
        const gs = kids.length ? await db.selectDistinct({ id: studentGuardians.guardianId }).from(studentGuardians).where(inn(studentGuardians.studentId, kids.map((k) => k.id))) : [];
        for (const g of gs) rows.push({ to: { kind: "guardian", id: g.id }, kind: "announcement_ping", vars: { title }, url: "/comms", fullText: body });
      }
      if (rows.length) await notifyMany({ id: s.id, name: s.name, branding: s.branding }, rows).catch(() => {});
    }
    void guardians;
  }
  await audit(u.id, "broadcast.send", null, { title, kind, roles, reached: targets.length });
  revalidatePath("/platform/broadcast");
  redirect(withFlash("/platform/broadcast", kind === "promo" ? `Promo is live for ${targets.length} schools.` : `Notice sent to ${targets.length} schools.`));
}

/** The promos a person should see now: running, for their role, in their school. */
export async function activePromos(schoolId: string, role: string) {
  const { platformBroadcasts } = await import("@/db/schema");
  const { and: andd, eq: eqq } = await import("drizzle-orm");
  const now = new Date();
  const rows = await db.select().from(platformBroadcasts).where(andd(eqq(platformBroadcasts.kind, "promo")));
  return rows.filter((b) => (b.roles ?? []).includes(role) && (!b.schoolIds || b.schoolIds.includes(schoolId))
    && (!b.startsAt || b.startsAt <= now) && (!b.endsAt || b.endsAt > now))
    .sort((a, b) => +b.createdAt - +a.createdAt)
    .map((b) => ({ id: b.id, title: b.title, body: b.body, ctaLabel: b.ctaLabel, ctaUrl: b.ctaUrl, imageUrl: b.imageUrl, everyHours: b.everyHours }));
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

/** Directly set a school's plan (the console's plan lever). */
export async function setSchoolPlan(schoolId: string, f: FormData) {
  const u = await requirePlatformAdmin();
  const planKey = String(f.get("planKey"));
  const [plan] = await db.select().from(plans).where(eq(plans.key, planKey));
  if (!plan) return;
  await db.update(schools).set({
    planKey, studentCap: plan.studentCap ?? 100000,
    storageCapMb: plan.storageCapMb, updatedAt: new Date(),
  }).where(eq(schools.id, schoolId));
  await audit(u.id, "plan.set", schoolId, { planKey });
  invalidateModules(schoolId);
  revalidatePath(`/platform/schools/${schoolId}`);
}
