"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { contactChannels, guardians, staff } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { withFlash } from "@/lib/flash";
import { setWhatsApp } from "./channels";

type Owner = "guardian" | "staff";
/** Bound arguments can be forged: only ever go back to a page of this app. */
const safe = (back: string) => back.startsWith("/") && !back.startsWith("//") ? back : "/";

/** The WhatsApp number and consent on a record. The office may change anyone's;
 *  everyone else only their own. `back` is the page the form sits on. */
export async function saveChannels(slug: string, ownerKind: Owner, ownerId: string, back: string, f: FormData) {
  back = safe(back); ownerKind = ownerKind === "guardian" ? "guardian" : "staff";
  const { school, user } = await requireSchool(slug);
  const table = ownerKind === "guardian" ? guardians : staff;
  const [who] = await db.select({ userId: table.userId }).from(table)
    .where(and(eq(table.id, ownerId), eq(table.schoolId, school.id)));
  const office = ["admin", "platform_admin"].includes(user.role);
  if (!who || (!office && who.userId !== user.id)) redirect(withFlash(back, "That could not be saved.", { error: true }));
  const phone = String(f.get("whatsapp") ?? "");
  const consent = f.get("whatsappConsent") === "on";
  await setWhatsApp(school.id, ownerKind, ownerId, phone, consent);
  revalidatePath(back);
  redirect(withFlash(back, !phone.trim() ? "WhatsApp number removed. Messages will come by SMS."
    : consent ? "Saved. School messages will come on WhatsApp."
      : "Number saved. Tick the box to agree before messages can come on WhatsApp."));
}

/** Stop Telegram messages for a record (the chat can be linked again any time). */
export async function unlinkTelegram(slug: string, ownerKind: Owner, ownerId: string, back: string) {
  back = safe(back); ownerKind = ownerKind === "guardian" ? "guardian" : "staff";
  const { school, user } = await requireSchool(slug);
  const table = ownerKind === "guardian" ? guardians : staff;
  const [who] = await db.select({ userId: table.userId }).from(table)
    .where(and(eq(table.id, ownerId), eq(table.schoolId, school.id)));
  if (!who || (!["admin", "platform_admin"].includes(user.role) && who.userId !== user.id)) redirect(back);
  await db.update(contactChannels).set({ telegramChatId: null, linkedAt: null })
    .where(and(eq(contactChannels.ownerKind, ownerKind), eq(contactChannels.ownerId, ownerId)));
  revalidatePath(back);
  redirect(withFlash(back, "Telegram unlinked."));
}
