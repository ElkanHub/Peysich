"use server";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { adminAccess, user as userTable } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { ACCESS_PRESETS, TAB_KEYS, type FeeActionKey } from "@/core/access";
import { createSchoolLogin } from "@/core/accounts";

const FEE_KEYS: FeeActionKey[] = ["record", "voidPay", "catalog", "generate"];

function grantsFromForm(f: FormData) {
  const preset = String(f.get("preset") || "");
  if (preset && ACCESS_PRESETS[preset]) {
    const p = ACCESS_PRESETS[preset];
    return { tabs: JSON.stringify(p.tabs), feeActions: JSON.stringify(p.fees) };
  }
  const tabs = TAB_KEYS.filter((t) => f.get(`tab_${t.key}`) === "on").map((t) => t.key);
  const fees: Partial<Record<FeeActionKey, boolean>> = {};
  for (const k of FEE_KEYS) if (f.get(`fee_${k}`) === "on") fees[k] = true;
  return { tabs: JSON.stringify(tabs), feeActions: JSON.stringify(fees) };
}

/** Only FULL admins manage the team. */
async function requireFullAdmin(slug: string) {
  const ctx = await requireSchool(slug, ["admin"]);
  if (ctx.grants) redirect(`/no-access?t=settings`);
  return ctx;
}

export type AddMemberResult = { loginAs: string; password: string } | { error: string };

/** Add a team member: an admin-role login limited to the ticked sections. */
export async function addTeamMember(slug: string, f: FormData): Promise<AddMemberResult> {
  const { school } = await requireFullAdmin(slug);
  const name = String(f.get("name") ?? "").trim();
  if (!name) return { error: "A name is needed" };
  const email = String(f.get("email") ?? "").trim() || null;
  const r = await createSchoolLogin({
    schoolId: school.id, schoolSlug: school.slug, name, role: "admin",
    email, username: email ? email.split("@")[0] : `team.${name.split(" ")[0]}.${Date.now().toString(36).slice(-4)}`,
  });
  if ("error" in r) return r;
  const g = grantsFromForm(f);
  await db.insert(adminAccess).values({
    userId: r.userId, schoolId: school.id, tabs: g.tabs, feeActions: g.feeActions,
  });
  revalidatePath(`/settings`);
  return { loginAs: r.loginAs, password: r.password };
}

/** Change what an existing member can reach. */
export async function updateMemberGrants(slug: string, userId: string, f: FormData) {
  const { school, user } = await requireFullAdmin(slug);
  if (userId === user.id) redirect(`/settings?err=selfgrant`);
  const [target] = await db.select().from(userTable).where(and(
    eq(userTable.id, userId), eq(userTable.schoolId, school.id), eq(userTable.role, "admin")));
  if (!target) redirect(`/settings?flash=error`);
  const g = grantsFromForm(f);
  if (f.get("full") === "on") {
    // promote to full admin — the grants row simply goes away
    await db.delete(adminAccess).where(eq(adminAccess.userId, userId));
  } else {
    await db.insert(adminAccess)
      .values({ userId, schoolId: school.id, tabs: g.tabs, feeActions: g.feeActions })
      .onConflictDoUpdate({
        target: adminAccess.userId,
        set: { tabs: g.tabs, feeActions: g.feeActions, updatedAt: new Date() },
      });
  }
  revalidatePath(`/settings`);
  redirect(`/settings?flash=saved#team`);
}

/** Remove a member's login entirely (their records stay; the door closes). */
export async function revokeTeamMember(slug: string, userId: string) {
  const { school, user } = await requireFullAdmin(slug);
  if (userId === user.id) redirect(`/settings?err=selfgrant`);
  // never remove the last full admin
  const admins = await db.select({ id: userTable.id }).from(userTable).where(and(
    eq(userTable.schoolId, school.id), eq(userTable.role, "admin"), ne(userTable.id, userId)));
  if (!admins.length) redirect(`/settings?err=lastadmin`);
  await db.delete(userTable).where(and(
    eq(userTable.id, userId), eq(userTable.schoolId, school.id), eq(userTable.role, "admin")));
  revalidatePath(`/settings`);
  redirect(`/settings?flash=done#team`);
}
