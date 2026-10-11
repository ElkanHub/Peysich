"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { platformAccess, user as userTable } from "@/db/schema";
import { CONSOLE_TABS, consoleAudit, requireConsoleOwner } from "@/core/console";
import { withFlash } from "@/lib/flash";

/** Save what a member may open. Every tab ticked = owner again (row removed). */
export async function setMemberTabs(userId: string, f: FormData) {
  const me = await requireConsoleOwner();
  if (userId === me.id) redirect(withFlash("/platform/team", "You are the owner here; your own access is not editable.", { error: true }));
  const tabs = CONSOLE_TABS.map((t) => t.key).filter((k) => f.get(`t_${k}`) === "on");
  const all = tabs.length === CONSOLE_TABS.length;
  if (all) await db.delete(platformAccess).where(eq(platformAccess.userId, userId));
  else await db.insert(platformAccess).values({ userId, tabs })
    .onConflictDoUpdate({ target: platformAccess.userId, set: { tabs, updatedAt: new Date() } });
  await consoleAudit(me.id, "console.access", null, { userId, tabs: all ? "owner" : tabs });
  revalidatePath("/platform/team");
  redirect(withFlash("/platform/team", all ? "Made an owner: every tab." : `Access saved: ${tabs.length} tab${tabs.length === 1 ? "" : "s"}.`));
}

/** Remove a console login altogether. The account row goes; nothing else does. */
export async function removeMember(userId: string) {
  const me = await requireConsoleOwner();
  if (userId === me.id) redirect(withFlash("/platform/team", "You cannot remove yourself.", { error: true }));
  const [u] = await db.select({ email: userTable.email, role: userTable.role }).from(userTable).where(eq(userTable.id, userId));
  if (!u || u.role !== "platform_admin") redirect("/platform/team");
  await db.delete(platformAccess).where(eq(platformAccess.userId, userId));
  await db.delete(userTable).where(eq(userTable.id, userId));
  await consoleAudit(me.id, "console.remove", null, { userId, email: u.email });
  revalidatePath("/platform/team");
  redirect(withFlash("/platform/team", `${u.email} no longer has a console login.`));
}
