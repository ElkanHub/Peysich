"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { academicYears, terms, classes, students, enrollments } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { uid } from "@/lib/utils";

/** Year-end promotion, the way it happens on the ground: every class gets a
 *  destination, and individual students can be held back to repeat. */
export async function runPromotion(slug: string, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  const [cls, roster] = await Promise.all([
    db.select().from(classes).where(eq(classes.schoolId, school.id)),
    db.select().from(students)
      .where(and(eq(students.schoolId, school.id), eq(students.status, "active"))),
  ]);

  // destination per class: a class id, "graduate", or "stay"
  const target = new Map<string, string>();
  for (const c of cls) target.set(c.id, String(f.get(`target_${c.id}`) || "stay"));
  const repeats = new Set<string>();
  for (const [k] of f.entries()) if (k.startsWith("repeat_")) repeats.add(k.slice(7));

  const yearName = String(f.get("yearName") ?? "").trim();
  const y = new Date().getFullYear();
  const yearId = uid();
  await db.update(academicYears).set({ isCurrent: false })
    .where(eq(academicYears.schoolId, school.id));
  await db.insert(academicYears).values({
    id: yearId, schoolId: school.id, name: yearName || `${y}/${y + 1}`,
    startsAt: `${y}-09-01`, endsAt: `${y + 1}-07-31`, isCurrent: true,
  });
  // the new year opens with its three terms, Term 1 current — attendance and
  // fees keep working the morning school resumes
  await db.update(terms).set({ isCurrent: false }).where(eq(terms.schoolId, school.id));
  const s0 = new Date(`${y}-09-01`).getTime(), e0 = new Date(`${y + 1}-07-31`).getTime();
  const third = (e0 - s0) / 3;
  const d = (t: number) => new Date(t).toISOString().slice(0, 10);
  await db.insert(terms).values([1, 2, 3].map((n) => ({
    id: uid(), schoolId: school.id, yearId, name: `Term ${n}`,
    startsAt: d(s0 + third * (n - 1)), endsAt: d(s0 + third * n),
    isCurrent: n === 1,
  })));

  for (const s of roster) {
    if (!s.classId) continue;
    if (repeats.has(s.id)) { // held back: same class, marked repeated
      await db.insert(enrollments).values({
        id: uid(), schoolId: school.id, studentId: s.id, yearId,
        classId: s.classId, status: "repeated",
      }).onConflictDoNothing();
      continue;
    }
    const dest = target.get(s.classId) ?? "stay";
    if (dest === "graduate") {
      await db.update(students).set({ status: "alumni" }).where(eq(students.id, s.id));
      continue;
    }
    const toClass = dest === "stay" ? s.classId : dest;
    if (toClass !== s.classId)
      await db.update(students).set({ classId: toClass }).where(eq(students.id, s.id));
    await db.insert(enrollments).values({
      id: uid(), schoolId: school.id, studentId: s.id, yearId,
      classId: toClass, status: dest === "stay" ? "enrolled" : "promoted",
    }).onConflictDoNothing();
  }

  revalidatePath("/");
  revalidatePath("/settings");
  redirect("/settings?promoted=1");
}
