"use server";
import { randomBytes } from "crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { schools, staff, signTokens } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { invalidateSchool } from "@/core/tenant";
import { getDocSignConfig } from "@/core/doc-sign";

/* Signatures & the school stamp (settings.docSign). Two signatures are
 * collected — the head teacher's and the main admin's. Papers show the head
 * teacher's; until it's collected the main admin's signs in its place. */

async function writeDocSign(slug: string, patch: Record<string, unknown>) {
  const { school } = await requireSchool(slug, ["admin"]);
  const cfg = getDocSignConfig(school.settings);
  const settings = {
    ...(school.settings as Record<string, unknown>),
    docSign: { ...cfg, ...patch },
  };
  await db.update(schools).set({ settings, updatedAt: new Date() }).where(eq(schools.id, school.id));
  invalidateSchool(slug);
  revalidatePath(`/settings`);
  return school;
}

/** Designate the Head Teacher (from staff) and name the main admin whose
 *  signature stands in wherever the head teacher's isn't collected yet. */
export async function saveDocSignPeople(slug: string, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  const headStaffId = String(f.get("headStaffId") ?? "");
  if (headStaffId) {
    const [s] = await db.select({ id: staff.id }).from(staff)
      .where(and(eq(staff.id, headStaffId), eq(staff.schoolId, school.id)));
    if (!s) redirect(`/settings?flash=error`);
  }
  await writeDocSign(slug, {
    headStaffId: headStaffId || null,
    adminName: String(f.get("adminName") ?? "").trim(),
  });
  redirect(`/settings?flash=saved`);
}

const IMAGE_SLOTS = ["headSigKey", "adminSigKey", "stampKey"] as const;
/** School-level slots, or `staff:<id>` — a teacher's own signature,
 *  collected on their staff file and stored on their row. */
export type DocImageSlot = (typeof IMAGE_SLOTS)[number] | `staff:${string}`;

function staffIdOfSlot(slot: string): string | null {
  return slot.startsWith("staff:") ? slot.slice(6) : null;
}
function validSlot(slot: string) {
  return (IMAGE_SLOTS as readonly string[]).includes(slot) || !!staffIdOfSlot(slot);
}

async function writeStaffSig(schoolId: string, staffId: string, key: string | null) {
  const [s] = await db.update(staff).set({ signatureKey: key })
    .where(and(eq(staff.id, staffId), eq(staff.schoolId, schoolId))).returning({ id: staff.id });
  return !!s;
}

/** Save an uploaded signature/stamp image key into its slot. Called from the
 *  upload hook, so it returns a result object instead of redirecting. */
export async function saveDocImage(slug: string, slot: DocImageSlot, key: string) {
  const { school } = await requireSchool(slug, ["admin"]);
  if (!validSlot(slot)) return { error: "Unknown image slot" };
  if (!key.startsWith(`school/${school.id}/`)) return { error: "Invalid file" };
  const staffId = staffIdOfSlot(slot);
  if (staffId) {
    if (!(await writeStaffSig(school.id, staffId, key))) return { error: "Staff member not found" };
    revalidatePath(`/staff/${staffId}`);
  } else {
    await writeDocSign(slug, { [slot]: key });
  }
  return { ok: true };
}

/** Remove a collected image so the fallback (or a blank line) applies again. */
export async function clearDocImage(slug: string, slot: DocImageSlot) {
  const { school } = await requireSchool(slug, ["admin"]);
  if (!validSlot(slot)) redirect(`/settings?flash=error`);
  const staffId = staffIdOfSlot(slot);
  if (staffId) {
    await writeStaffSig(school.id, staffId, null);
    revalidatePath(`/staff/${staffId}`);
    redirect(`/staff/${staffId}?flash=saved`);
  }
  await writeDocSign(slug, { [slot]: null });
  redirect(`/settings?flash=saved`);
}

/** Mint a sign-on-phone token: the PC shows it as a QR code, the phone opens
 *  /sign/<token> and draws (or photographs) straight into this slot. Long,
 *  random, 15-minute, single-use — the token is the whole credential. */
export async function createSignToken(slug: string, slot: DocImageSlot) {
  const { school, user } = await requireSchool(slug, ["admin"]);
  if (!validSlot(slot)) return { error: "Unknown image slot" };
  const staffId = staffIdOfSlot(slot);
  if (staffId) {
    const [s] = await db.select({ id: staff.id }).from(staff)
      .where(and(eq(staff.id, staffId), eq(staff.schoolId, school.id)));
    if (!s) return { error: "Staff member not found" };
  }
  const token = randomBytes(24).toString("base64url");
  await db.insert(signTokens).values({
    id: token, schoolId: school.id, slot, createdBy: user.id,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });
  return { token };
}
