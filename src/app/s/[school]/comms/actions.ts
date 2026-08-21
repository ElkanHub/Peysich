"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { announcements, events, guardians } from "@/db/schema";
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
  redirect(`/comms?flash=saved`);
}

export async function createEvent(slug: string, f: FormData) {
  const { school } = await requireModule(slug, "comms", ["admin"]);
  await db.insert(events).values({
    id: uid(), schoolId: school.id, title: String(f.get("title")),
    startsAt: new Date(String(f.get("startsAt"))),
  });
  revalidatePath(`/comms`);
  redirect(`/comms?flash=saved`);
}

/** Blast to all of THIS school's guardians — SMS and/or email, chosen per
 *  send. Recipients come strictly from this school's guardian list, so a
 *  parent never hears from a school that isn't theirs. Gateways are behind
 *  sendSms()/sendEmail(); without keys, messages log as "queued". */
export async function sendBlast(slug: string, f: FormData) {
  const { school } = await requireModule(slug, "comms", ["admin"]);
  const body = String(f.get("body"));
  const viaSms = f.get("viaSms") === "on";
  const viaEmail = f.get("viaEmail") === "on";
  if (!viaSms && !viaEmail) redirect(`/comms?flash=error`);
  const gs = await db.select().from(guardians).where(eq(guardians.schoolId, school.id));
  const { sendSmsBatch, sendEmailBlast } = await import("@/lib/notify");
  if (viaSms) {
    const seen = new Set<string>();
    await sendSmsBatch(gs.filter((g) => g.phone && !seen.has(g.phone) && seen.add(g.phone)).map((g) => ({
      schoolId: school.id, to: g.phone, body: `${body} — ${school.name}`,
      kind: "blast", senderId: school.branding.smsSenderId,
    })));
  }
  if (viaEmail) {
    const seenE = new Set<string>();
    await sendEmailBlast(gs
      .filter((g) => g.email && !seenE.has(g.email!) && seenE.add(g.email!))
      .map((g) => ({
        schoolId: school.id, to: g.email!, schoolName: school.name,
        subject: `${school.name} — message to parents`, body,
      })));
  }
  revalidatePath(`/comms`);
  redirect(`/comms?flash=saved`);
}

/** Mark announcements as seen by this user — closes the on-open notice and
 *  clears the tab badge. */
export async function acknowledgeAnnouncements(slug: string, ids: string[]) {
  const { school, user } = await requireModule(slug, "comms");
  const { announcementAcks } = await import("@/db/schema");
  if (!ids.length) return;
  await db.insert(announcementAcks).values(ids.map((annId) => ({
    id: uid(), schoolId: school.id, announcementId: annId, userId: user.id,
  }))).onConflictDoNothing();
  revalidatePath(`/comms`);
}
