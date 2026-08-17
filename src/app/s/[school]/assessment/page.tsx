import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, subjects, levels } from "@/db/schema";
import { requireModule, getCurrentTerm, getTeacherClassIds } from "@/core/school-context";
import { Card, PageHeader } from "@/ui/kit";

/** Pick class → subject → score sheet. */
export default async function Assessment({ params }: { params: Promise<{ school: string }> }) {
  const { school: slug } = await params;
  const { school, user } = await requireModule(slug, "assessment", ["admin", "teacher"]);
  const mine = user.role === "teacher" ? await getTeacherClassIds(school.id, user.id) : undefined;
  const term = await getCurrentTerm(school.id);
  let [cls, subs] = await Promise.all([
    db.select().from(classes).where(eq(classes.schoolId, school.id)),
    db.select().from(subjects).where(eq(subjects.schoolId, school.id)),
  ]);
  const lvs = await db.select().from(levels).where(eq(levels.schoolId, school.id));
  const preschool = new Set(lvs.filter((l) => l.preschool).map((l) => l.id));
  if (mine !== undefined) cls = cls.filter((c) => mine?.has(c.id));
  return (
    <div>
      <PageHeader title="Assessment"
        sub={term ? `${term.name}${term.scoresLocked ? " · closed" : ""}` : "No current term"} />
      <div className="space-y-4">
        {cls.map((c) => (
          <Card key={c.id}>
            <p className="font-medium">{c.name}
              {preschool.has(c.levelId) && <span className="ml-2 text-xs text-muted-foreground">preschool · skills-based</span>}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {preschool.has(c.levelId) ? (
                <Link href={`/assessment/skills/${c.id}`}
                  className="rounded-md border border-primary px-3 py-1.5 text-sm text-primary hover:bg-muted">
                  Skills assessment grid
                </Link>
              ) : subs.map((s) => (
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
