"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { platformAuditLogs, schoolModules, schools } from "@/db/schema";
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
  redirect(`/schools/${id}`);
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
  revalidatePath(`/schools/${schoolId}`);
}

export async function setSchoolStatus(schoolId: string, status: "active" | "suspended") {
  const u = await requirePlatformAdmin();
  await db.update(schools).set({ status, updatedAt: new Date() }).where(eq(schools.id, schoolId));
  await audit(u.id, `school.${status === "active" ? "reactivate" : "suspend"}`, schoolId, {});
  revalidatePath(`/schools/${schoolId}`);
}
