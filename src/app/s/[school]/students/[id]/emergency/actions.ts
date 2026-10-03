"use server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { messages } from "@/db/schema";
import { withFlash } from "@/lib/flash";
import { uid } from "@/lib/utils";
import { notifyMany, sentSentence } from "@/messaging/notify";
import { render } from "@/messaging/render";
import { EMERGENCIES } from "@/messaging/templates";
import { emergencyContext } from "./context";

/** Send now: every guardian of the child, by WhatsApp and SMS both, even with
 *  an empty wallet. The record of it stays in the app as a `messages` row. */
export async function sendEmergency(slug: string, id: string, f: FormData) {
  const { school, user, s, parents } = await emergencyContext(slug, id);
  const back = `/students/${id}/emergency`;
  const kind = EMERGENCIES.find(([k]) => k === f.get("reason"))?.[0];
  if (!kind) redirect(withFlash(back, "Choose what has happened first. Nothing was sent.", { error: true }));
  if (!parents.length) redirect(withFlash(back, "No parent is on this child's file. Call the emergency contact.", { error: true }));
  const vars = {
    school: school.name, child: `${s.firstName} ${s.lastName}`, phone: school.branding.phone || "the school office",
    detail: String(f.get("detail") ?? "").trim() || "Please call the school.",
    time: String(f.get("time") ?? "").trim() || "the office",
  };
  const messageId = uid();
  await db.insert(messages).values({
    id: messageId, schoolId: school.id, kind: "emergency", studentId: id, createdBy: user.id,
    title: EMERGENCIES.find(([k]) => k === kind)![1], body: render(kind, vars),
  });
  const r = await notifyMany(school, parents.map((p) => ({
    to: { kind: "guardian" as const, id: p.id }, kind, vars, messageId, url: "/",
  })));
  redirect(withFlash(`/students/${id}`, sentSentence(r) || "Nothing could be sent — no parent has a phone number. Call them."));
}
