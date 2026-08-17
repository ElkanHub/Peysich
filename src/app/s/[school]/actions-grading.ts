"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { gradingSchemes, schools, skillDomains } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { uid } from "@/lib/utils";

export async function saveGradingScheme(
  slug: string, caWeight: number,
  bands: { min: number; grade: string; remark: string }[],
) {
  const { school } = await requireSchool(slug, ["admin"]);
  const ca = Math.max(0, Math.min(100, Math.round(caWeight)));
  const clean = bands
    .filter((b) => b.grade.trim())
    .map((b) => ({ min: Math.max(0, Math.min(100, b.min)), grade: b.grade.trim(), remark: b.remark.trim() }))
    .sort((a, b) => b.min - a.min);
  if (!clean.length) return { error: "At least one band required" };
  await db.insert(gradingSchemes)
    .values({ schoolId: school.id, caWeight: ca, examWeight: 100 - ca, bands: clean })
    .onConflictDoUpdate({
      target: [gradingSchemes.schoolId],
      set: { caWeight: ca, examWeight: 100 - ca, bands: clean },
    });
  revalidatePath("/settings");
  return { ok: true };
}

export async function saveLogo(slug: string, key: string) {
  const { school } = await requireSchool(slug, ["admin"]);
  if (!key.startsWith(`school/${school.id}/`)) return { error: "Invalid file" };
  await db.update(schools).set({
    branding: { ...school.branding, logoUrl: key }, updatedAt: new Date(),
  }).where(eq(schools.id, school.id));
  revalidatePath("/settings");
  return { ok: true };
}

const DEFAULT_DOMAINS = [
  "Language & Literacy", "Numeracy", "Motor Skills", "Social & Emotional",
  "Creative Expression", "Independence & Self-help",
];

export async function ensureSkillDomains(slug: string) {
  const { school } = await requireSchool(slug, ["admin", "teacher"]);
  const existing = await db.select().from(skillDomains).where(eq(skillDomains.schoolId, school.id));
  if (existing.length) return;
  await db.insert(skillDomains).values(DEFAULT_DOMAINS.map((name, i) => ({
    id: uid(), schoolId: school.id, name, sortOrder: i,
  })));
  revalidatePath("/assessment");
}
