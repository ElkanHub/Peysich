import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { levels, scorePublications } from "@/db/schema";
import { requireModule, getCurrentTerm, getTeacherScope } from "@/core/school-context";
import { getStructure, SECTIONS, SECTION_LABELS, type Section } from "@/core/academics";
import { Card, PageHeader, Badge, btnGhostCls } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";
import { publishComponent } from "./actions";

/** Pick class → subject → score sheet. Subject chips come from the class's
 *  EFFECTIVE list (section set ± deviations, Settings → Day plan & subjects). */
export default async function Assessment({ params }: { params: Promise<{ school: string }> }) {
  const { school: slug } = await params;
  const { school, user } = await requireModule(slug, "assessment", ["admin", "teacher"]);
  const scope = user.role === "teacher" ? await getTeacherScope(school.id, user.id) : undefined;
  const term = await getCurrentTerm(school.id);
  const S = await getStructure(school.id);
  let cls = S.classes;
  const lvs = await db.select().from(levels).where(eq(levels.schoolId, school.id));
  const preschool = new Set(lvs.filter((l) => l.preschool).map((l) => l.id));
  if (scope !== undefined) cls = cls.filter((c) => scope?.allClassIds.has(c.id));
  // effective subjects of the class; subject teachers see only their cells within it
  const subjectsFor = (classId: string) => {
    const eff = S.effectiveSubjectIds(classId)
      .map((id) => S.subjectById.get(id)!).filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
    return !scope || scope.homeroomIds.has(classId)
      ? eff
      : eff.filter((su) => scope.cells.some((ce) => ce.classId === classId && ce.subjectId === su.id));
  };
  const pubs = !scope && term
    ? await db.select().from(scorePublications).where(and(
        eq(scorePublications.schoolId, school.id), eq(scorePublications.termId, term.id)))
    : [];
  const pubBy = new Map(pubs.map((p) => [p.componentId, p]));
  const testSections = SECTIONS.filter((s2) =>
    s2 !== "preschool" && S.classes.some((c) => S.sectionOfClass(c) === s2));

  return (
    <div>
      <PageHeader title="Assessment"
        sub={term ? `${term.name}${term.scoresLocked ? " · closed" : ""}` : "No current term"} />

      {/* admin: what families can see, one publish per test */}
      {!scope && term && (
        <Card className="mb-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-semibold">Publish to families</h2>
            <Link href="/settings/assessment" className="text-[12.5px] font-medium text-primary">
              Configure the scheme →
            </Link>
          </div>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Students and parents see nothing until you publish. Publish each test when its
            marks are in — the exam goes out with the terminal report.
          </p>
          <div className="mt-3 space-y-2">
            {testSections.map((sec) => (
              <div key={sec} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-20 shrink-0 font-medium">{SECTION_LABELS[sec as Section]}</span>
                {S.componentsFor(sec as Section).map((c2) => {
                  const p = pubBy.get(c2.id);
                  return c2.isExam ? (
                    <Badge key={c2.id} tone="default">{c2.name} — with the report</Badge>
                  ) : p ? (
                    <Badge key={c2.id} tone="success">{c2.name} published ✓</Badge>
                  ) : (
                    <form key={c2.id} action={publishComponent.bind(null, slug, c2.id)}>
                      <SubmitButton className={btnGhostCls + " px-2.5 py-1 text-[12.5px]"} pendingText="Publishing…">
                        Publish {c2.name}
                      </SubmitButton>
                    </form>
                  );
                })}
              </div>
            ))}
          </div>
        </Card>
      )}

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
