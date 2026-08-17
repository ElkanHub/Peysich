"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { announcements, events, guardians, smsLog } from "@/db/schema";
import { requireModule } from "@/core/school-context";
import { uid } from "@/lib/utils";

export async function postAnnouncement(slug: string, f: FormData) {
  const { school, user } = await requireModule(slug, "comms", ["admin", "teacher"]);
  await db.insert(announcements).values({
    id: uid(), schoolId: school.id, title: String(f.get("title")),
    body: String(f.get("body")), classId: String(f.get("classId") || "") || null,
    createdBy: user.id,
  });
  revalidatePath(`/comms`);
}

export async function createEvent(slug: string, f: FormData) {
  const { school } = await requireModule(slug, "comms", ["admin"]);
  await db.insert(events).values({
    id: uid(), schoolId: school.id, title: String(f.get("title")),
    startsAt: new Date(String(f.get("startsAt"))),
  });
  revalidatePath(`/comms`);
}

/** SMS blast to all guardians. Gateway wiring is behind sendSms(); until the
 *  key exists (HANDOFF.md) messages log as "queued" and cost is tracked. */
export async function sendBlast(slug: string, f: FormData) {
  const { school } = await requireModule(slug, "comms", ["admin"]);
  const body = String(f.get("body"));
  const gs = await db.select().from(guardians).where(eq(guardians.schoolId, school.id));
  const seen = new Set<string>();
  const rows = gs.filter((g) => !seen.has(g.phone) && seen.add(g.phone)).map((g) => ({
    id: uid(), schoolId: school.id, to: g.phone, body, kind: "blast",
    status: process.env.SMS_API_KEY ? "sent" : "queued",
  }));
  if (rows.length) await db.insert(smsLog).values(rows);
  revalidatePath(`/comms`);
}
