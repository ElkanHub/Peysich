import { and, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/db";
import { announcements, announcementAcks, classes } from "@/db/schema";
import { getParentChildren, getStudentSelf } from "@/core/portal";

/** Announcements this user hasn't acknowledged yet (last 30 days), scoped
 *  the same way the feed is: school-wide + the classes that concern them.
 *  Drives the on-open notice and the Announcements tab badge. */
export async function getUnackedAnnouncements(
  schoolId: string, userId: string, role: string,
) {
  const since = new Date(Date.now() - 30 * 86400000);
  const [anns, acks, cls] = await Promise.all([
    db.select().from(announcements).where(and(
      eq(announcements.schoolId, schoolId), gte(announcements.createdAt, since)))
      .limit(30),
    db.select({ annId: announcementAcks.announcementId }).from(announcementAcks)
      .where(eq(announcementAcks.userId, userId)),
    db.select({ id: classes.id, name: classes.name }).from(classes)
      .where(eq(classes.schoolId, schoolId)),
  ]);
  const acked = new Set(acks.map((a) => a.annId));
  let visible: Set<string> | null = null; // null = everything
  if (role === "parent") {
    const kids = await getParentChildren(schoolId, userId);
    visible = new Set(kids.map((k) => k.classId).filter(Boolean) as string[]);
  } else if (role === "student") {
    const me = await getStudentSelf(schoolId, userId);
    visible = new Set([me?.classId].filter(Boolean) as string[]);
  }
  const className = new Map(cls.map((c) => [c.id, c.name]));
  return anns
    .filter((a) => !acked.has(a.id))
    .filter((a) => !visible || !a.classId || visible.has(a.classId))
    .sort((a, b) => +b.createdAt - +a.createdAt)
    .map((a) => ({
      id: a.id, title: a.title, body: a.body,
      audience: a.classId ? className.get(a.classId) ?? "" : "School-wide",
      date: a.createdAt.toISOString().slice(0, 10),
    }));
}
