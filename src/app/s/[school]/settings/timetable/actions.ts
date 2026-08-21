"use server";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  classes, sectionConfig, periodSlots, sectionSubjects, classSubjectOverrides,
} from "@/db/schema";
import { requireModule } from "@/core/school-context";
import { SECTIONS, sectionOf, type Section } from "@/core/academics";
import { uid } from "@/lib/utils";

const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const back = "/settings/timetable";

function asSection(v: unknown): Section {
  const s = String(v);
  if (!SECTIONS.includes(s as Section)) throw new Error("Unknown section");
  return s as Section;
}

/** Class-teacher vs subject-teaching, decided once per section. */
export async function setSectionMode(slug: string, f: FormData) {
  const { school } = await requireModule(slug, "timetable", ["admin"]);
  const section = asSection(f.get("section"));
  const mode = String(f.get("mode")) === "class_teacher" ? "class_teacher" : "subject_teaching";
  await db.update(sectionConfig).set({ mode })
    .where(and(eq(sectionConfig.schoolId, school.id), eq(sectionConfig.section, section)));
  revalidatePath(back); revalidatePath("/timetable");
  redirect(`${back}?s=${section}&flash=saved`);
}

export async function addSlot(slug: string, f: FormData) {
  const { school } = await requireModule(slug, "timetable", ["admin"]);
  const section = asSection(f.get("section"));
  const startMin = toMin(String(f.get("start"))), endMin = toMin(String(f.get("end")));
  if (endMin <= startMin) redirect(`${back}?s=${section}&err=times`);
  await db.insert(periodSlots).values({
    id: uid(), schoolId: school.id, section,
    name: String(f.get("name") || "Period").trim(),
    kind: String(f.get("kind") || "teaching"),
    startMin, endMin, sortOrder: 99,
  });
  revalidatePath(back); revalidatePath("/timetable");
  redirect(`${back}?s=${section}&flash=saved`);
}

export async function saveSlot(slug: string, slotId: string, f: FormData) {
  const { school } = await requireModule(slug, "timetable", ["admin"]);
  const section = asSection(f.get("section"));
  const startMin = toMin(String(f.get("start"))), endMin = toMin(String(f.get("end")));
  if (endMin <= startMin) redirect(`${back}?s=${section}&err=times`);
  await db.update(periodSlots).set({
    name: String(f.get("name") || "Period").trim(),
    kind: String(f.get("kind") || "teaching"),
    startMin, endMin,
  }).where(and(eq(periodSlots.id, slotId), eq(periodSlots.schoolId, school.id)));
  revalidatePath(back); revalidatePath("/timetable");
  redirect(`${back}?s=${section}&flash=saved`);
}

/** Removing a period also clears any lessons placed in it (FK cascade) —
 *  the UI says so before they click. */
export async function deleteSlot(slug: string, slotId: string, section: string) {
  const { school } = await requireModule(slug, "timetable", ["admin"]);
  await db.delete(periodSlots)
    .where(and(eq(periodSlots.id, slotId), eq(periodSlots.schoolId, school.id)));
  revalidatePath(back); revalidatePath("/timetable");
  redirect(`${back}?s=${section}&flash=done`);
}

/** The section's subject set — what every class in it inherits. */
export async function saveSectionSubjects(slug: string, f: FormData) {
  const { school } = await requireModule(slug, "timetable", ["admin"]);
  const section = asSection(f.get("section"));
  const chosen = f.getAll("subjectId").map(String);
  await db.delete(sectionSubjects).where(and(
    eq(sectionSubjects.schoolId, school.id), eq(sectionSubjects.section, section)));
  if (chosen.length) {
    await db.insert(sectionSubjects).values(chosen.map((sid) => ({
      id: uid(), schoolId: school.id, section, subjectId: sid,
    }))).onConflictDoNothing();
  }
  revalidatePath(back); revalidatePath("/timetable"); revalidatePath("/assessment");
  revalidatePath("/staff/allocations");
  redirect(`${back}?s=${section}&flash=saved`);
}

/** One class deviating from its section: the checkboxes describe the class's
 *  full list; we store only the diff against the section set. */
export async function saveClassDeviation(slug: string, classId: string, f: FormData) {
  const { school } = await requireModule(slug, "timetable", ["admin"]);
  const [cls] = await db.select({ id: classes.id, levelId: classes.levelId })
    .from(classes).where(and(eq(classes.id, classId), eq(classes.schoolId, school.id)));
  if (!cls) redirect(back);
  const { levels } = await import("@/db/schema");
  const [lvl] = await db.select().from(levels).where(eq(levels.id, cls.levelId));
  const section = sectionOf(lvl?.code ?? "b1");
  const base = new Set((await db.select().from(sectionSubjects).where(and(
    eq(sectionSubjects.schoolId, school.id), eq(sectionSubjects.section, section),
  ))).map((r) => r.subjectId));
  const chosen = new Set(f.getAll("subjectId").map(String));

  const adds = [...chosen].filter((s) => !base.has(s));
  const removes = [...base].filter((s) => !chosen.has(s));
  await db.delete(classSubjectOverrides).where(and(
    eq(classSubjectOverrides.schoolId, school.id), eq(classSubjectOverrides.classId, classId)));
  const rows = [
    ...adds.map((s) => ({ id: uid(), schoolId: school.id, classId, subjectId: s, action: "add" })),
    ...removes.map((s) => ({ id: uid(), schoolId: school.id, classId, subjectId: s, action: "remove" })),
  ];
  if (rows.length) await db.insert(classSubjectOverrides).values(rows);
  revalidatePath(back); revalidatePath("/timetable"); revalidatePath("/assessment");
  revalidatePath("/staff/allocations");
  redirect(`${back}?s=${section}&cls=${classId}&flash=saved`);
}
