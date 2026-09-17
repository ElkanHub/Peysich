import webpush from "web-push";
import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { pushSubscriptions, user, guardians, studentGuardians, students, staff, classes } from "@/db/schema";

/* ── Push notifications ─────────────────────────────────────────────────────
   Keys come from `npx web-push generate-vapid-keys` (docs/CONNECTIONS.md §5).
   Without them nothing here throws — sends are simply skipped, the same
   graceful shape as email and SMS. */

const PUB = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIV = process.env.VAPID_PRIVATE_KEY;
export const pushEnabled = !!(PUB && PRIV);
if (pushEnabled) webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:hello@schoolspec.app", PUB!, PRIV!);

export type PushPayload = { title: string; body: string; url?: string; tag?: string; icon?: string };

/** Sends to every device the given people turned notifications on in.
 *  Dead subscriptions clean themselves up. Never throws. */
export async function pushToUsers(userIds: string[], payload: PushPayload) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!pushEnabled || !ids.length) return { sent: 0, removed: 0 };
  const subs = await db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, ids));
  let sent = 0, removed = 0;
  const body = JSON.stringify(payload);
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 24 * 3600 });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) { await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id)); removed++; }
    }
  }));
  return { sent, removed };
}

/** Who in a school should hear about something. `classId` narrows parents
 *  and students to that class (and adds its teacher); staff and admins
 *  always hear school-wide news. `exclude` is usually the author. */
export async function schoolAudience(schoolId: string, opts: {
  roles?: ("admin" | "teacher" | "parent" | "student")[]; classId?: string | null; exclude?: string;
} = {}) {
  const roles = opts.roles ?? ["admin", "teacher", "parent", "student"];
  const out = new Set<string>();
  if (!opts.classId) {
    const rows = await db.select({ id: user.id, role: user.role }).from(user)
      .where(and(eq(user.schoolId, schoolId), inArray(user.role, roles)));
    for (const r of rows) out.add(r.id);
  } else {
    const kids = await db.select({ id: students.id, userId: students.userId }).from(students)
      .where(and(eq(students.schoolId, schoolId), eq(students.classId, opts.classId), eq(students.status, "active")));
    if (roles.includes("student")) for (const k of kids) if (k.userId) out.add(k.userId);
    if (roles.includes("parent") && kids.length) {
      const gs = await db.select({ userId: guardians.userId }).from(studentGuardians)
        .innerJoin(guardians, eq(studentGuardians.guardianId, guardians.id))
        .where(inArray(studentGuardians.studentId, kids.map((k) => k.id)));
      for (const g of gs) if (g.userId) out.add(g.userId);
    }
    if (roles.includes("teacher")) {
      const [cls] = await db.select({ t: classes.classTeacherId, f: classes.formMasterId }).from(classes)
        .where(eq(classes.id, opts.classId));
      const sids = [cls?.t, cls?.f].filter((x): x is string => !!x);
      if (sids.length) {
        const ts = await db.select({ userId: staff.userId }).from(staff).where(inArray(staff.id, sids));
        for (const t of ts) if (t.userId) out.add(t.userId);
      }
    }
    if (roles.includes("admin")) {
      const admins = await db.select({ id: user.id }).from(user)
        .where(and(eq(user.schoolId, schoolId), or(eq(user.role, "admin"))));
      for (const a of admins) out.add(a.id);
    }
  }
  if (opts.exclude) out.delete(opts.exclude);
  return [...out];
}
