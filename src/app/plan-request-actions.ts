"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { planRequests, schools } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { invalidateSchool } from "@/core/tenant";
import { estimatePesewas, ADDON_MODULES, SIZE_BANDS } from "@/core/plan-const";
import { uid } from "@/lib/utils";

/* Plan requests — return, don't throw: every path hands the button a value
 * it can toast. Estimates are recomputed server-side so the number we call
 * about is the number the person saw. */

function cleanModules(keys: unknown): string[] {
  return Array.isArray(keys) ? keys.filter((k): k is string => ADDON_MODULES.includes(k as string)) : [];
}
const validBand = (b: unknown) => SIZE_BANDS.some((s) => s.key === b) ? String(b) : SIZE_BANDS[0].key;

/** A signed-in admin asks for a custom plan. Identity comes from the account
 *  and the school file — we call, we don't email-tag. */
export async function submitCustomRequest(slug: string, payload: {
  moduleKeys: string[]; sizeBand: string; phone?: string;
}) {
  const { school, user } = await requireSchool(slug, ["admin"]);
  const moduleKeys = cleanModules(payload.moduleKeys);
  const sizeBand = validBand(payload.sizeBand);
  const phone = String(payload.phone ?? "").trim() || school.branding.phone || "";
  if (!phone) return { error: "Add a phone number we can call you on." };
  await db.insert(planRequests).values({
    id: uid(), schoolId: school.id, kind: "custom",
    name: user.name ?? "School admin", phone, schoolName: school.name,
    moduleKeys, sizeBand, estimatePesewas: estimatePesewas(moduleKeys, sizeBand),
    source: "app",
  });
  return { ok: true };
}

/** The public marketing builder — no account, so the lead form carries the
 *  contact. A honeypot field quietly drops the bots. */
export async function submitPublicPlanRequest(payload: {
  name?: string; schoolName?: string; phone?: string; hp?: string;
  moduleKeys: string[]; sizeBand: string;
}) {
  if (payload.hp) return { ok: true }; // bot fed the honeypot — pretend success
  const name = String(payload.name ?? "").trim();
  const schoolName = String(payload.schoolName ?? "").trim();
  const phone = String(payload.phone ?? "").trim();
  if (name.length < 2 || schoolName.length < 2 || phone.length < 9)
    return { error: "Your name, the school's name and a phone number — that's all we need." };
  const moduleKeys = cleanModules(payload.moduleKeys);
  const sizeBand = validBand(payload.sizeBand);
  await db.insert(planRequests).values({
    id: uid(), kind: "custom", name, phone, schoolName,
    moduleKeys, sizeBand, estimatePesewas: estimatePesewas(moduleKeys, sizeBand),
    source: "website",
  });
  return { ok: true };
}

/** Cancelling asks WHY before it lets go — the reason and a line are
 *  compulsory, and the renewal hold is recorded on the school file so the
 *  Billing page shows the pending state honestly. */
export async function requestCancellation(slug: string, payload: {
  reason: string; message: string; phone?: string;
}) {
  const { school, user } = await requireSchool(slug, ["admin"]);
  const reason = String(payload.reason ?? "").trim();
  const message = String(payload.message ?? "").trim();
  if (!reason) return { error: "Pick the reason that fits best — it's required." };
  if (message.length < 4) return { error: "Add a line about it — a person reads every one." };
  await db.insert(planRequests).values({
    id: uid(), schoolId: school.id, kind: "cancel",
    name: user.name ?? "School admin",
    phone: String(payload.phone ?? "").trim() || school.branding.phone || "—",
    schoolName: school.name, reason, message, source: "app",
  });
  const settings = {
    ...(school.settings as Record<string, unknown>),
    cancelRequested: { at: new Date().toISOString(), reason },
  };
  await db.update(schools).set({ settings, updatedAt: new Date() }).where(eq(schools.id, school.id));
  invalidateSchool(slug);
  revalidatePath(`/billing`);
  return { ok: true };
}
