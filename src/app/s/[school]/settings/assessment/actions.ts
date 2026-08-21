"use server";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  assessmentComponents, componentScores, sectionConfig, skillDomains, skillRatings,
} from "@/db/schema";
import { requireModule } from "@/core/school-context";
import { SECTIONS, type Section } from "@/core/academics";
import { uid } from "@/lib/utils";

const back = "/settings/assessment";

function asSection(v: unknown): Section {
  const s = String(v);
  if (!SECTIONS.includes(s as Section)) throw new Error("Unknown section");
  return s as Section;
}

/** Save a section's whole marking scheme in one go: rename/reweigh existing
 *  components, add one new, tick others for removal. Refused unless names are
 *  unique and the weights (kept + new) total exactly 100. */
export async function saveScheme(slug: string, f: FormData) {
  const { school } = await requireModule(slug, "assessment", ["admin"]);
  const section = asSection(f.get("section"));
  const existing = await db.select().from(assessmentComponents).where(and(
    eq(assessmentComponents.schoolId, school.id), eq(assessmentComponents.section, section)));

  type Row = { id: string | null; name: string; weight: number; isExam: boolean; del: boolean };
  const rows: Row[] = existing.map((c) => ({
    id: c.id,
    name: String(f.get(`name_${c.id}`) ?? c.name).trim(),
    weight: Math.max(0, Math.round(Number(f.get(`weight_${c.id}`)) || 0)),
    isExam: c.isExam,
    del: f.get(`del_${c.id}`) === "on" && !c.isExam, // the exam row never deletes
  }));
  const newName = String(f.get("newName") ?? "").trim();
  const newWeight = Math.max(0, Math.round(Number(f.get("newWeight")) || 0));
  if (newName) rows.push({ id: null, name: newName, weight: newWeight, isExam: false, del: false });

  const kept = rows.filter((r) => !r.del);
  const names = kept.map((r) => r.name.toLowerCase());
  if (new Set(names).size !== names.length) redirect(`${back}?s=${section}&err=dupname`);
  if (kept.some((r) => !r.name)) redirect(`${back}?s=${section}&err=noname`);
  const total = kept.reduce((a, r) => a + r.weight, 0);
  if (total !== 100) redirect(`${back}?s=${section}&err=total&t=${total}`);

  // removing a component that already has marks needs an explicit tick
  for (const r of rows.filter((r) => r.del && r.id)) {
    const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(componentScores)
      .where(eq(componentScores.componentId, r.id!));
    if (Number(n) > 0 && f.get("confirmDelete") !== "on")
      redirect(`${back}?s=${section}&err=hasmarks`);
  }

  for (const r of rows) {
    if (r.del && r.id) {
      await db.delete(assessmentComponents).where(eq(assessmentComponents.id, r.id)); // sheets+marks cascade
    } else if (r.id) {
      await db.update(assessmentComponents).set({ name: r.name, weight: r.weight })
        .where(eq(assessmentComponents.id, r.id));
    } else {
      const maxSort = existing.filter((c) => !c.isExam).length;
      await db.insert(assessmentComponents).values({
        id: uid(), schoolId: school.id, section, name: r.name, weight: r.weight,
        sortOrder: maxSort, isExam: false,
      });
    }
  }
  revalidatePath(back); revalidatePath("/assessment");
  redirect(`${back}?s=${section}&flash=saved`);
}

/** The rating labels for skills-based sections (e.g. Emerging → Secure). */
export async function saveSkillScale(slug: string, f: FormData) {
  const { school } = await requireModule(slug, "assessment", ["admin"]);
  const section = asSection(f.get("section"));
  const labels = f.getAll("label").map((l) => String(l).trim()).filter(Boolean);
  if (labels.length < 2) redirect(`${back}?s=${section}&err=scale2`);
  if (new Set(labels.map((l) => l.toLowerCase())).size !== labels.length)
    redirect(`${back}?s=${section}&err=dupname`);
  await db.update(sectionConfig).set({ skillScale: labels })
    .where(and(eq(sectionConfig.schoolId, school.id), eq(sectionConfig.section, section)));
  revalidatePath(back); revalidatePath("/assessment");
  redirect(`${back}?s=${section}&flash=saved`);
}

export async function addSkillArea(slug: string, f: FormData) {
  const { school } = await requireModule(slug, "assessment", ["admin"]);
  const name = String(f.get("name") ?? "").trim();
  if (!name) redirect(`${back}?s=preschool`);
  const all = await db.select().from(skillDomains).where(eq(skillDomains.schoolId, school.id));
  if (all.some((d) => d.name.toLowerCase() === name.toLowerCase()))
    redirect(`${back}?s=preschool&err=dupname`);
  await db.insert(skillDomains).values({
    id: uid(), schoolId: school.id, name, sortOrder: all.length,
  });
  revalidatePath(back);
  redirect(`${back}?s=preschool&flash=saved`);
}

export async function renameSkillArea(slug: string, domainId: string, f: FormData) {
  const { school } = await requireModule(slug, "assessment", ["admin"]);
  const name = String(f.get("name") ?? "").trim();
  if (!name) redirect(`${back}?s=preschool`);
  await db.update(skillDomains).set({ name })
    .where(and(eq(skillDomains.id, domainId), eq(skillDomains.schoolId, school.id)));
  revalidatePath(back);
  redirect(`${back}?s=preschool&flash=saved`);
}

/** Removing an area also removes children's ratings in it — confirm first. */
export async function deleteSkillArea(slug: string, domainId: string, f: FormData) {
  const { school } = await requireModule(slug, "assessment", ["admin"]);
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(skillRatings)
    .where(eq(skillRatings.domainId, domainId));
  if (Number(n) > 0 && f.get("confirm") !== "on")
    redirect(`${back}?s=preschool&err=hasratings`);
  await db.delete(skillDomains)
    .where(and(eq(skillDomains.id, domainId), eq(skillDomains.schoolId, school.id)));
  revalidatePath(back);
  redirect(`${back}?s=preschool&flash=done`);
}
