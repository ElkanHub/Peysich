import { cache } from "react";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { adminAccess, user as userTable } from "@/db/schema";

/* Team & access: one admin ROLE, per-person grants. A user with no
 * admin_access row is a FULL admin (the school administrator). A row makes
 * them a limited member: `tabs` lists what they may open, `fees` which
 * money actions they may take. This is how a cashier exists without being
 * a fifth role. */

import type { FeeActionKey } from "./access-const";
export { TAB_KEYS, FEE_ACTION_LABELS, ACCESS_PRESETS, type FeeActionKey } from "./access-const";

export type AdminGrants = {
  tabs: Set<string>;
  fees: Record<FeeActionKey, boolean>;
};

/** null = full admin. Cached per request. */
export const getAdminGrants = cache(async (schoolId: string, userId: string): Promise<AdminGrants | null> => {
  const [row] = await db.select().from(adminAccess)
    .where(and(eq(adminAccess.userId, userId), eq(adminAccess.schoolId, schoolId)));
  if (!row) return null;
  let tabs: string[] = [];
  let fees: Partial<Record<FeeActionKey, boolean>> = {};
  try { tabs = JSON.parse(row.tabs); } catch { /* empty grant */ }
  try { fees = JSON.parse(row.feeActions); } catch { /* none */ }
  return {
    tabs: new Set(tabs),
    fees: {
      record: !!fees.record, voidPay: !!fees.voidPay,
      catalog: !!fees.catalog, generate: !!fees.generate,
    },
  };
});

/** May this admin take a money action? Full admins always may. */
export async function canFeeAction(schoolId: string, userId: string, role: string, action: FeeActionKey) {
  if (role === "platform_admin") return true;
  if (role !== "admin") return false;
  const g = await getAdminGrants(schoolId, userId);
  return !g || g.fees[action];
}

/** The school's FULL admins — who a blocked member should ask. */
export const getFullAdmins = cache(async (schoolId: string) => {
  const [admins, limited] = await Promise.all([
    db.select({ id: userTable.id, name: userTable.name }).from(userTable)
      .where(and(eq(userTable.schoolId, schoolId), eq(userTable.role, "admin"))),
    db.select({ userId: adminAccess.userId }).from(adminAccess)
      .where(eq(adminAccess.schoolId, schoolId)),
  ]);
  const limitedIds = new Set(limited.map((l) => l.userId));
  return admins.filter((a) => !limitedIds.has(a.id));
});
