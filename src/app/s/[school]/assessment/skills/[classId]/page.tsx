import { and, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { classes, levels, students, skillDomains, skillRatings } from "@/db/schema";
import { requireModule, getCurrentTerm, getTeacherScope } from "@/core/school-context";
import { ensureSkillDomains } from "../../../actions-grading";
import { PageHeader } from "@/ui/kit";
import { SkillsGrid } from "./grid";

/** Preschool skills-based assessment (doc 05: a mode of assessment, not a module). */
export default async function SkillsPage({ params }: {
  params: Promise<{ school: string; classId: string }>;
}) {
  const { school: slug, classId } = await params;
  const { school, user } = await requireModule(slug, "assessment", ["admin", "teacher"]);
  if (user.role === "teacher") {
    const scope = await getTeacherScope(school.id, user.id);
    if (!scope?.homeroomIds.has(classId)) notFound();
  }
  const term = await getCurrentTerm(school.id);
  const [cls] = await db.select().from(classes)
    .where(and(eq(classes.id, classId), eq(classes.schoolId, school.id)));
  if (!cls || !term) notFound();
  const [lv] = await db.select().from(levels).where(eq(levels.id, cls.levelId));
  if (!lv?.preschool) notFound();

  await ensureSkillDomains(slug); // seed default domains on first visit
  const { getStructure } = await import("@/core/academics");
  const S = await getStructure(school.id);
  const scale = S.skillScaleFor("preschool");
  const [domains, roster] = await Promise.all([
    db.select().from(skillDomains).where(eq(skillDomains.schoolId, school.id))
      .orderBy(skillDomains.sortOrder),
    db.select({ id: students.id, firstName: students.firstName, lastName: students.lastName })
      .from(students).where(and(eq(students.schoolId, school.id),
        eq(students.classId, classId), eq(students.status, "active")))
      .orderBy(students.lastName),
  ]);
  const existing = roster.length
    ? await db.select().from(skillRatings).where(and(
        eq(skillRatings.termId, term.id),
        inArray(skillRatings.studentId, roster.map((r) => r.id))))
    : [];

  return (
    <div>
      <PageHeader title={`${cls.name} · Skills assessment`}
        sub={`${term.name} · tap a cell to cycle ${scale.join(" → ")}`} />
      <SkillsGrid slug={slug} classId={classId} scale={scale}
        domains={domains.map((d) => ({ id: d.id, name: d.name }))}
        roster={roster}
        initial={Object.fromEntries(existing.map((r) => [`${r.studentId}:${r.domainId}`, r.rating]))} />
    </div>
  );
}
