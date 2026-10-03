"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { announcements, events, guardians } from "@/db/schema";
import { requireModule } from "@/core/school-context";
import { uid } from "@/lib/utils";
import { withFlash } from "@/lib/flash";

export async function postAnnouncement(slug: string, f: FormData) {
  const { school, user } = await requireModule(slug, "comms", ["admin", "teacher"]);
  const title = String(f.get("title"));
  const classId = String(f.get("classId") || "") || null;
  await db.insert(announcements).values({
    id: uid(), schoolId: school.id, title,
    body: String(f.get("body")), classId,
    createdBy: user.id,
  });
  // phones that opted in hear it now — the class's people for a class notice,
  // the whole school otherwise; never the author
  const { pushToUsers, schoolAudience } = await import("@/lib/push");
  await pushToUsers(await schoolAudience(school.id, { classId, exclude: user.id }),
    { title: school.name, body: title, url: "/comms", tag: "announcement" });
  revalidatePath(`/comms`);
  redirect(withFlash(`/comms`, "Notice sent. Everyone it concerns sees it when they next open the app."));
}

export async function createEvent(slug: string, f: FormData) {
  const { school } = await requireModule(slug, "comms", ["admin"]);
  await db.insert(events).values({
    id: uid(), schoolId: school.id, title: String(f.get("title")),
    startsAt: new Date(String(f.get("startsAt"))),
    classId: String(f.get("classId") || "") || null,
  });
  revalidatePath(`/comms`);
  redirect(withFlash(`/comms`, "Event added to the calendar."));
}

/** Message to all of THIS school's guardians — a ping and/or email, chosen
 *  per send. Recipients come strictly from this school's guardian list, so a
 *  parent never hears from a school that isn't theirs. The ping goes through
 *  notify(); without provider keys it waits in the outbox as "queued". */
export async function sendBlast(slug: string, f: FormData) {
  const { school, user } = await requireModule(slug, "comms", ["admin"]);
  const body = String(f.get("body"));
  const viaSms = f.get("viaSms") === "on";
  const viaEmail = f.get("viaEmail") === "on";
  if (!viaSms && !viaEmail) redirect(withFlash(`/comms`, "Tick SMS or Email first — nothing was sent.", { error: true }));
  const gs = await db.select().from(guardians).where(eq(guardians.schoolId, school.id));
  const { sendEmailBlast } = await import("@/lib/notify");
  const { sentSentence } = await import("@/messaging/notify");
  let sent = 0, smsNote = "";
  if (viaSms) {
    // the text lives in the app; each parent gets a ping with their own link —
    // the app and Telegram free, then WhatsApp or SMS. A phone-only parent
    // gets the whole text by SMS, signed as withSignature() previews.
    const { sendToParents } = await import("@/messaging/messages");
    const r = await sendToParents(school, { body, createdBy: user.id });
    sent = r.sent + r.free;
    smsNote = sentSentence(r);
  }
  if (viaEmail) {
    const seenE = new Set<string>();
    const rows = gs
      .filter((g) => g.email && !seenE.has(g.email!) && seenE.add(g.email!))
      .map((g) => ({
        schoolId: school.id, to: g.email!, schoolName: school.name,
        subject: `${school.name} — message to parents`, body,
      }));
    await sendEmailBlast(rows);
    if (!viaSms) sent = rows.length;
  }
  revalidatePath(`/comms`);
  const at = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Accra" });
  redirect(withFlash(`/comms`, `Sent to ${sent} parents at ${at}. ${smsNote}`.trim()));
}

/** "Remind the rest": the ping goes again to every parent who has not opened it. */
export async function remindRest(slug: string, messageId: string) {
  const { school } = await requireModule(slug, "comms", ["admin"]);
  const { remindUnread } = await import("@/messaging/messages");
  const { sentSentence } = await import("@/messaging/notify");
  const r = await remindUnread(school, messageId);
  revalidatePath(`/comms`);
  redirect(withFlash(`/comms`, r ? sentSentence(r) || "Everyone has already read it." : "That message could not be found.", { error: !r }));
}

/** Mark announcements as seen by this user — closes the on-open notice and
 *  clears the tab badge. Returns {ok} so the modal can react honestly
 *  instead of closing over a failed write. */
export async function acknowledgeAnnouncements(
  slug: string, ids: string[],
): Promise<{ ok: boolean }> {
  try {
    const { school, user } = await requireModule(slug, "comms");
    const { announcementAcks } = await import("@/db/schema");
    if (!ids.length) return { ok: true };
    await db.insert(announcementAcks).values(ids.map((annId) => ({
      id: uid(), schoolId: school.id, announcementId: annId, userId: user.id,
    }))).onConflictDoNothing();
    revalidatePath(`/comms`);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Acknowledge a single announcement from its card on the feed. */
export async function acknowledgeOne(slug: string, annId: string) {
  const { school, user } = await requireModule(slug, "comms");
  const { announcementAcks } = await import("@/db/schema");
  await db.insert(announcementAcks).values({
    id: uid(), schoolId: school.id, announcementId: annId, userId: user.id,
  }).onConflictDoNothing();
  revalidatePath(`/comms`);
  redirect(withFlash(`/comms`, "Acknowledged."));
}
