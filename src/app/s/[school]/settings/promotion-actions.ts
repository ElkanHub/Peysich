"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { academicYears, terms, classes, students, enrollments } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { uid } from "@/lib/utils";
import { withFlash } from "@/lib/flash";
import { listTerms } from "@/core/terms";

/** Year-end promotion, the way it happens on the ground: every class gets a
 *  destination, and individual students can be held back to repeat. */
export async function runPromotion(slug: string, f: FormData) {
  const { school, user } = await requireSchool(slug, ["admin"]);
  const stillOpen = (await listTerms(school.id)).find((t) => t.state !== "closed" && t.state !== "upcoming");
  if (stillOpen) redirect(withFlash("/", `Close ${stillOpen.name} first — the year closes only when every term has.`, { error: true }));
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
  // next year's real term dates, as the school knows them
  const dates = [1, 2, 3].map((n) => [String(f.get(`t${n}s`) ?? ""), String(f.get(`t${n}e`) ?? "")]);
  if (dates.some(([s, e]) => !/^\d{4}-\d{2}-\d{2}$/.test(s) || !/^\d{4}-\d{2}-\d{2}$/.test(e) || e < s))
    redirect(withFlash("/settings/promotion", "Give each of next year's three terms a first and last day.", { error: true }));
  let moved = 0, left = 0;
  const yearId = uid();
  // the old year is complete; every term of it is already closed (checked above)
  await db.update(academicYears).set({ isCurrent: false, closedAt: new Date() })
    .where(and(eq(academicYears.schoolId, school.id), eq(academicYears.isCurrent, true)));
  await db.update(academicYears).set({ isCurrent: false }).where(eq(academicYears.schoolId, school.id));
  await db.insert(academicYears).values({
    id: yearId, schoolId: school.id, name: yearName || `${y}/${y + 1}`,
    startsAt: dates[0][0], endsAt: dates[2][1], isCurrent: true,
  });
  // the new year's three terms wait as upcoming; the sweep opens Term 1 on its first day
  await db.update(terms).set({ isCurrent: false }).where(eq(terms.schoolId, school.id));
  await db.insert(terms).values([1, 2, 3].map((n) => ({
    id: uid(), schoolId: school.id, yearId, name: `Term ${n}`,
    startsAt: dates[n - 1][0], endsAt: dates[n - 1][1], isCurrent: n === 1,
  })));
  const { platformAuditLogs } = await import("@/db/schema");
  await db.insert(platformAuditLogs).values({
    id: uid(), actorUserId: user.id, action: "year.close", schoolId: school.id,
    detail: { nextYear: yearName || `${y}/${y + 1}`, by: user.name },
  });

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
      left++;
      continue;
    }
    const toClass = dest === "stay" ? s.classId : dest;
    if (toClass !== s.classId) {
      await db.update(students).set({ classId: toClass }).where(eq(students.id, s.id));
      moved++;
    }
    await db.insert(enrollments).values({
      id: uid(), schoolId: school.id, studentId: s.id, yearId,
      classId: toClass, status: dest === "stay" ? "enrolled" : "promoted",
    }).onConflictDoNothing();
  }

  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath("/archives");
  redirect(withFlash("/archives",
    `The year is closed and in Archives. ${moved} children moved up; ${left} became past students. ${yearName || `${y}/${y + 1}`} opens on its first day.`));
}
