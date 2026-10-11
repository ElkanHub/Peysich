import { cache } from "react";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { platformAccess, platformAuditLogs } from "@/db/schema";
import { getSession } from "./session";
import { uid } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────────
 * Console team & access (docs/12 §3.1). One role, platform_admin; per-person
 * grants: a platform_access row lists the tabs a member may open. No row =
 * owner, everything. Mirrors Team & access inside a school.
 * ──────────────────────────────────────────────────────────────────────── */

export const CONSOLE_TABS: { key: string; label: string; href: string }[] = [
  { key: "overview", label: "Overview", href: "/platform" },
  { key: "schools", label: "Schools", href: "/platform/schools" },
  { key: "plans", label: "Plans", href: "/platform/plans" },
  { key: "requests", label: "Requests", href: "/platform/requests" },
  { key: "subscriptions", label: "Subscriptions", href: "/platform/subscriptions" },
  { key: "financials", label: "Financials", href: "/platform/financials" },
  { key: "messaging", label: "Messaging", href: "/platform/messaging" },
  { key: "broadcast", label: "Broadcast", href: "/platform/broadcast" },
  { key: "users", label: "All users", href: "/platform/users" },
  { key: "activity", label: "Activity log", href: "/platform/audit" },
  { key: "team", label: "Team", href: "/platform/team" },
  { key: "settings", label: "Settings", href: "/platform/settings" },
];
export type ConsoleTab = (typeof CONSOLE_TABS)[number]["key"];

/** One-click starting points — stored as plain grants, always editable. */
export const CONSOLE_PRESETS: Record<string, { label: string; tabs: string[] }> = {
  sales: { label: "Sales", tabs: ["overview", "schools", "broadcast", "users"] },
  support: { label: "Support", tabs: ["overview", "schools", "users", "activity", "messaging"] },
  finance: { label: "Finance", tabs: ["overview", "financials", "subscriptions", "plans", "requests"] },
};

export type ConsoleUser = { id: string; name: string; email: string; role: string };

/** null = owner. Cached per request. */
export const getConsoleGrants = cache(async (userId: string): Promise<Set<string> | null> => {
  const [row] = await db.select().from(platformAccess).where(eq(platformAccess.userId, userId));
  return row ? new Set(row.tabs) : null;
});

/** The console login, or sign-in. */
export const requireConsoleUser = cache(async (): Promise<ConsoleUser> => {
  const session = await getSession();
  const u = session?.user as ConsoleUser | undefined;
  if (!u || u.role !== "platform_admin") redirect("/sign-in");
  return u;
});

/** The gate every console page goes through: a member without the tab lands on Overview. */
export async function requireConsole(tab: ConsoleTab) {
  const u = await requireConsoleUser();
  const grants = await getConsoleGrants(u.id);
  if (grants && !grants.has(tab)) redirect("/platform?denied=" + tab);
  return { user: u, grants };
}

/** Owners only: the team page and anything that changes who may do what. */
export async function requireConsoleOwner() {
  const u = await requireConsoleUser();
  if (await getConsoleGrants(u.id)) redirect("/platform?denied=team");
  return u;
}

export async function consoleAudit(actorUserId: string, action: string, schoolId: string | null, detail: Record<string, unknown>) {
  await db.insert(platformAuditLogs).values({ id: uid(), actorUserId, action, schoolId, detail });
}
