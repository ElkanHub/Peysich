import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, subjects, levels } from "@/db/schema";
import { requireModule, getCurrentTerm, getTeacherScope } from "@/core/school-context";
import { Card, PageHeader } from "@/ui/kit";

/** Pick class → subject → score sheet. */
export default async function Assessment({ params }: { params: Promise<{ school: string }> }) {
  const { school: slug } = await params;
  const { school, user } = await requireModule(slug, "assessment", ["admin", "teacher"]);
  const scope = user.role === "teacher" ? await getTeacherScope(school.id, user.id) : undefined;
  const term = await getCurrentTerm(school.id);
  let [cls, subs] = await Promise.all([
    db.select().from(classes).where(eq(classes.schoolId, school.id)),
    db.select().from(subjects).where(eq(subjects.schoolId, school.id)),
  ]);
  const lvs = await db.select().from(levels).where(eq(levels.schoolId, school.id));
  const preschool = new Set(lvs.filter((l) => l.preschool).map((l) => l.id));
  if (scope !== undefined) cls = cls.filter((c) => scope?.allClassIds.has(c.id));
  // homeroom → every subject of the class; subject teacher → only their cells
  const subjectsFor = (classId: string) =>
    !scope || scope.homeroomIds.has(classId)
      ? subs
      : subs.filter((su) => scope.cells.some((ce) => ce.classId === classId && ce.subjectId === su.id));
  return (
    <div>
      <PageHeader title="Assessment"
        sub={term ? `${term.name}${term.scoresLocked ? " · closed" : ""}` : "No current term"} />
      <div className="space-y-4">
        {cls.map((c) => (
          <Card key={c.id}>
            <p className="font-medium">{c.name}
              {preschool.has(c.levelId) && <span className="ml-2 text-xs text-muted-foreground">preschool · skills-based</span>}
              {scope && !scope.homeroomIds.has(c.id) &&
                <span className="ml-2 text-xs text-muted-foreground">subject teacher</span>}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {preschool.has(c.levelId) ? (
                (!scope || scope.homeroomIds.has(c.id)) ? (
                <Link href={`/assessment/skills/${c.id}`}
                  className="rounded-md border border-primary px-3 py-1.5 text-sm text-primary hover:bg-muted">
                  Skills assessment grid
                </Link>
                ) : <span className="text-xs text-muted-foreground">Skills grid is the class teacher&apos;s</span>
              ) : subjectsFor(c.id).map((s) => (
                <Link key={s.id} href={`/assessment/${c.id}/${s.id}`}
                  className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
                  {s.name}
                </Link>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
