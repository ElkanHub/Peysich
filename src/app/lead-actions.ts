"use server";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { uid } from "@/lib/utils";

/** Public lead capture from the marketing page → platform Leads pipeline. */
export async function submitLead(_: unknown, f: FormData) {
  const name = String(f.get("name") ?? "").trim();
  const phone = String(f.get("phone") ?? "").trim();
  if (name.length < 2 || phone.length < 9) return { error: "Please add your name and a valid phone number" };
  if (String(f.get("company") ?? "")) return { ok: true }; // honeypot: silently drop bots
  await db.insert(leads).values({
    id: uid(), name, phone,
    schoolName: String(f.get("schoolName") ?? "").trim() || null,
    email: String(f.get("email") ?? "").trim() || null,
    message: String(f.get("message") ?? "").trim().slice(0, 1000) || null,
  });
  return { ok: true };
}
