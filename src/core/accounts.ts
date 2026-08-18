import { eq } from "drizzle-orm";
import { auth } from "./auth";
import { db } from "@/db";
import { user as userTable } from "@/db/schema";

/** Human-friendly temp password (shown once to the admin who issued it). */
export function tempPassword() {
  const words = ["lion", "eagle", "river", "sunny", "amber", "cedar", "delta", "coral"];
  const w = words[Math.floor(Math.random() * words.length)];
  return `${w}${Math.floor(1000 + Math.random() * 9000)}`;
}

/** Create a login for a school person. No email → synthetic address + username
 *  sign-in (school-issued logins, doc 10: no self-signup inside a school). */
export async function createSchoolLogin(opts: {
  schoolId: string | null; schoolSlug: string; name: string; role: "admin" | "teacher" | "student" | "parent";
  email?: string | null; username: string; phone?: string | null;
}) {
  const username = opts.username.toLowerCase().replace(/[^a-z0-9._-]/g, "");
  const email = opts.email?.trim() || `${username}@${opts.schoolSlug}.peysich.local`;
  const [dup] = await db.select({ id: userTable.id }).from(userTable).where(eq(userTable.email, email));
  if (dup) return { error: "An account already exists for this email/username" as const };
  const password = tempPassword();
  await auth.api.signUpEmail({ body: { email, password, name: opts.name, username } });
  await db.update(userTable)
    .set({ role: opts.role, schoolId: opts.schoolId, phone: opts.phone ?? null })
    .where(eq(userTable.email, email));
  const [u] = await db.select({ id: userTable.id }).from(userTable).where(eq(userTable.email, email));
  return { userId: u.id, loginAs: opts.email?.trim() || username, password };
}
