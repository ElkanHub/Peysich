import Link from "next/link";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { students, scorePublications, scoreSheets, reportCards, levels, terms, academicYears } from "@/db/schema";
import { requireModule, getCurrentTerm } from "@/core/school-context";
import { getStructure, SECTIONS, SECTION_LABELS, type Section } from "@/core/academics";
import { getReportConfig, REPORT_CONFIG_LABELS, REPORT_CONFIG_DEFAULTS, type ReportConfig } from "@/modules/assessment/report-config";
import { Card, PageHeader, Badge, Empty, btnCls, btnGhostCls } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";
import { releaseComponent, releaseTermReports, releasePreschoolReports, saveReportConfig } from "./actions";
import { skillRatings } from "@/db/schema";
import { inArray } from "drizzle-orm";

const fmtDate = (d: Date) =>
  d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Accra" });

/** REPORTS — everything that goes out to families, in one place:
 *  each release tracked separately (what, when, by whom), the readiness to
 *  release, how the paper looks, and a read-only browser of the records.
 *  Nothing is edited here except the paper's design. */
export default async function Reports({ params, searchParams }: {
  params: Promise<{ school: string }>;
  searchParams: Promise<{ c?: string; t?: string }>;
}) {
  const { school: slug } = await params;
  const sp = await searchParams;
  const { school } = await requireModule(slug, "assessment", ["admin"]);
  const current = await getCurrentTerm(school.id);
  if (!current) return <div><PageHeader title="Reports" sub="No current term" />
    <Empty title="Set up your academic year first" hint="Settings → Academic year & terms." /></div>;
  // any term, any year — records stay findable long after a term closes
  const [allTerms, yrs] = await Promise.all([
    db.select().from(terms).where(eq(terms.schoolId, school.id)),
    db.select().from(academicYears).where(eq(academicYears.schoolId, school.id)),
  ]);
  const term = allTerms.find((x) => x.id === sp.t) ?? current;
  const viewingPast = term.id !== current.id;
  const yearName = new Map(yrs.map((y) => [y.id, y.name]));

  const S = await getStructure(school.id);
  const lvs = await db.select().from(levels).where(eq(levels.schoolId, school.id));
  const preschool = new Set(lvs.filter((l) => l.preschool).map((l) => l.id));
  const cfg = getReportConfig(school.settings);

  const [pubs, sheets, [reportsPublished]] = await Promise.all([
    db.select().from(scorePublications).where(and(
      eq(scorePublications.schoolId, school.id), eq(scorePublications.termId, term.id))),
    db.select().from(scoreSheets).where(and(
      eq(scoreSheets.schoolId, school.id), eq(scoreSheets.termId, term.id))),
    db.select({ n: sql<number>`count(*)` }).from(reportCards)
      .where(and(eq(reportCards.schoolId, school.id), eq(reportCards.termId, term.id),
        eq(reportCards.published, true))),
  ]);
  const pubBy = new Map(pubs.map((p) => [p.componentId, p]));
  const submittedBy = new Set(sheets.filter((s) => s.submitted)
    .map((s) => `${s.classId}:${s.subjectId}:${s.componentId}`));
  const testClasses = S.classes.filter((c) => !preschool.has(c.levelId))
    .sort((a, b) => (S.levelById.get(a.levelId)?.sortOrder ?? 0) - (S.levelById.get(b.levelId)?.sortOrder ?? 0) || a.name.localeCompare(b.name));
  const testSections = SECTIONS.filter((s2) =>
    s2 !== "preschool" && testClasses.some((c) => S.sectionOfClass(c) === s2));
  const reportsN = Number(reportsPublished?.n ?? 0);

  const classReady = (classId: string, compId: string) => {
    const subs = S.effectiveSubjectIds(classId);
    const done = subs.filter((sid) => submittedBy.has(`${classId}:${sid}:${compId}`)).length;
    return { done, total: subs.length, ready: subs.length > 0 && done === subs.length };
  };

  // preschool: their whole assessment is the skills grid, released end of term
  const preClasses = S.classes.filter((c) => preschool.has(c.levelId))
    .sort((a, b) => (S.levelById.get(a.levelId)?.sortOrder ?? 0) - (S.levelById.get(b.levelId)?.sortOrder ?? 0) || a.name.localeCompare(b.name));
  const preClassIds = preClasses.map((c) => c.id);
  const preKids = preClassIds.length
    ? await db.select({ id: students.id }).from(students).where(and(
        eq(students.schoolId, school.id), eq(students.status, "active"),
        inArray(students.classId, preClassIds)))
    : [];
  const preKidIds = preKids.map((k) => k.id);
  const [ratedKids, preReleased] = await Promise.all([
    preKidIds.length
      ? db.select({ studentId: skillRatings.studentId }).from(skillRatings).where(and(
          eq(skillRatings.termId, term.id), inArray(skillRatings.studentId, preKidIds)))
      : [],
    preKidIds.length
      ? db.select({ studentId: reportCards.studentId, publishedAt: reportCards.publishedAt })
          .from(reportCards).where(and(eq(reportCards.termId, term.id),
            eq(reportCards.published, true), inArray(reportCards.studentId, preKidIds)))
      : [],
  ]);
  const ratedCount = new Set(ratedKids.map((r) => r.studentId)).size;
  const preReleasedAt = preReleased.map((r) => r.publishedAt).filter((d): d is Date => !!d)
    .sort((a, b) => +a - +b).at(-1) ?? null;

  const allClasses = [...preClasses, ...testClasses];
  const activeClass = allClasses.find((c) => c.id === sp.c) ?? testClasses[0] ?? preClasses[0];
  const roster = activeClass
    ? await db.select({ id: students.id, firstName: students.firstName, lastName: students.lastName })
        .from(students).where(and(eq(students.schoolId, school.id),
          eq(students.classId, activeClass.id), eq(students.status, "active")))
        .orderBy(students.lastName)
    : [];
  const withReport = new Set((await db.select({ studentId: reportCards.studentId })
    .from(reportCards).where(and(eq(reportCards.schoolId, school.id),
      eq(reportCards.termId, term.id), eq(reportCards.published, true))))
    .map((r) => r.studentId));

  return (
    <div>
      <PageHeader title="Reports"
        sub={`${yearName.get(term.yearId)} · ${term.name} · what families receive — released per test, tracked separately`} />

      {/* records are term-scoped and year-scoped — every past term stays reachable */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[...yrs].sort((a, b) => b.startsAt.localeCompare(a.startsAt)).map((y) => (
          <span key={y.id} className="flex items-center gap-1.5">
            <span className="text-[13px] font-medium text-muted-foreground" data-nums="">{y.name}:</span>
            {allTerms.filter((x) => x.yearId === y.id)
              .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
              .map((x) => (
                <Link key={x.id} href={`/reports?t=${x.id}`}
                  className={`rounded-full px-2.5 py-1 text-[13px] font-medium ${x.id === term.id
                    ? "bg-brand-container text-on-brand-container" : "border border-border hover:bg-muted"}`}>
                  {x.name}
                </Link>
              ))}
          </span>
        ))}
      </div>
      {viewingPast && (
        <p className="mb-4 rounded-md bg-muted px-3 py-2 text-[13.5px] text-muted-foreground">
          You are looking at a past term&apos;s records — reference only, nothing here can be released or changed.
        </p>
      )}

      {/* ── releases: one row per test, its own state, nothing blurred ── */}
      <Card className="mb-5">
        <h2 className="font-semibold">{viewingPast ? `Releases in ${term.name}` : "Releases this term"}</h2>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          Each test is released on its own — families see exactly what has been released and
          nothing else. A release always carries the child&apos;s full record, every subject at once.
        </p>
        <div className="mt-3 space-y-4">
          {testSections.map((sec) => (
            <div key={sec}>
              <p className="mb-1.5 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">{SECTION_LABELS[sec as Section]}</p>
              <ul className="divide-y divide-border">
                {S.componentsFor(sec as Section).filter((c) => !c.isExam).map((c) => {
                  const secClasses = testClasses.filter((cl) => S.sectionOfClass(cl) === sec);
                  const readiness = secClasses.map((cl) => ({ cl, ...classReady(cl.id, c.id) }));
                  const readyCount = readiness.filter((r) => r.ready).length;
                  const gaps = readiness.filter((r) => !r.ready);
                  const p = pubBy.get(c.id);
                  return (
                    <li key={c.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                      <span className="w-44 shrink-0 font-medium">{c.name}</span>
                      {p ? (
                        <>
                          <Badge tone="success">released ✓</Badge>
                          <span className="text-[13.5px] text-muted-foreground">
                            {fmtDate(p.publishedAt)} by {p.publishedBy}
                          </span>
                        </>
                      ) : (
                        <>
                          <Badge tone="default">not released</Badge>
                          <span className={`text-[13.5px] ${readyCount === secClasses.length ? "text-success" : "text-warning"}`} data-nums="">
                            {readyCount}/{secClasses.length} classes fully submitted
                          </span>
                          {gaps.length > 0 && (
                            <span className="text-[12.5px] text-muted-foreground"
                              title={gaps.map((g) => `${g.cl.name}: ${g.done}/${g.total} subjects`).join(" · ")}>
                              waiting on {gaps.slice(0, 3).map((g) => g.cl.name).join(", ")}{gaps.length > 3 ? ` +${gaps.length - 3}` : ""}
                            </span>
                          )}
                          {!viewingPast && (
                            <form action={releaseComponent.bind(null, slug, c.id)} className="ml-auto">
                              <SubmitButton className={btnGhostCls + " px-2.5 py-1 text-[13.5px]"} pendingText="Releasing…">
                                Release {c.name}
                              </SubmitButton>
                            </form>
                          )}
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {/* preschool — skills-based, so their release IS the end-of-term report */}
          {preClasses.length > 0 && (
            <div className="border-t border-border pt-3">
              <p className="mb-1.5 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">Preschool</p>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-44 shrink-0 font-medium">Skills report (end of term)</span>
                {preReleased.length > 0 ? (
                  <>
                    <Badge tone="success">released ✓</Badge>
                    <span className="text-[13.5px] text-muted-foreground" data-nums="">
                      {preReleased.length} of {preKidIds.length} children
                      {preReleasedAt ? ` · ${fmtDate(preReleasedAt)}` : ""}
                    </span>
                  </>
                ) : (
                  <>
                    <Badge tone="default">not released</Badge>
                    <span className={`text-[13.5px] ${ratedCount === preKidIds.length && preKidIds.length > 0 ? "text-success" : "text-warning"}`} data-nums="">
                      {ratedCount}/{preKidIds.length} children rated on the skills grid
                    </span>
                  </>
                )}
                {!viewingPast && (
                  <form action={releasePreschoolReports.bind(null, slug)} className="ml-auto">
                    <SubmitButton className={btnGhostCls + " px-2.5 py-1 text-[13.5px]"} pendingText="Releasing…">
                      {preReleased.length ? "Re-release skills reports" : "Release skills reports"}
                    </SubmitButton>
                  </form>
                )}
              </div>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                Preschool is assessed on the skills grid, not tests — this single release sends each
                child&apos;s Learning &amp; Development record to their family. Children with nothing
                rated yet are skipped, and the term stays open.
              </p>
            </div>
          )}

          {/* terminal report — its own, separate release */}
          <div className="border-t border-border pt-3">
            <p className="mb-1.5 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">Terminal report</p>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-44 shrink-0 font-medium">Report cards (incl. exam)</span>
              {reportsN > 0 ? (
                <>
                  <Badge tone="success">released ✓</Badge>
                  <span className="text-[13.5px] text-muted-foreground" data-nums="">
                    {reportsN} report cards with families · scores locked
                  </span>
                </>
              ) : (
                <Badge tone="default">not released</Badge>
              )}
              {!viewingPast && (
                <form action={releaseTermReports.bind(null, slug)} className="ml-auto">
                  <SubmitButton className={reportsN ? btnGhostCls + " px-2.5 py-1 text-[13.5px]" : btnCls} pendingText="Publishing…">
                    {reportsN ? "Re-publish report cards" : "Publish report cards"}
                  </SubmitButton>
                </form>
              )}
            </div>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              Publishing the terminal report computes every child&apos;s CA + exam totals, locks the
              term&apos;s scores, and includes preschool skills reports.
              {" "}<Link href="/assessment/matrix" className="font-medium text-primary">Score-entry completeness matrix →</Link>
            </p>
          </div>
        </div>
      </Card>

      {/* ── how the paper looks ── */}
      <Card className="mb-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-semibold">Report design</h2>
          <Link href="/settings" className="text-[13.5px] font-medium text-primary">
            Logo, colours &amp; motto values → Branding
          </Link>
        </div>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          Tick what appears on every printed record and report card.
        </p>
        <form action={saveReportConfig.bind(null, slug)} className="mt-3">
          <div className="grid gap-1.5 sm:grid-cols-2">
            {(Object.keys(REPORT_CONFIG_DEFAULTS) as (keyof ReportConfig)[]).map((k) => (
              <label key={k} className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-[14px]">
                <input type="checkbox" name={`cfg_${k}`} defaultChecked={cfg[k]} />
                {REPORT_CONFIG_LABELS[k]}
              </label>
            ))}
          </div>
          <SubmitButton className={btnCls + " mt-3"} pendingText="Saving…">Save design</SubmitButton>
        </form>
      </Card>

      {/* ── read-only records browser ── */}
      <Card>
        <h2 className="font-semibold">The records</h2>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          Open any child&apos;s record exactly as it prints. Reading only — marks are edited under Assessment.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {allClasses.map((c) => (
            <Link key={c.id} href={`?c=${c.id}&t=${term.id}`}
              className={`rounded-md border px-2.5 py-1 text-[13.5px] font-medium ${c.id === activeClass?.id
                ? "border-primary/40 bg-brand-container text-on-brand-container" : "border-border hover:bg-muted"}`}>
              {c.name}
            </Link>
          ))}
        </div>
        <ul className="mt-3 divide-y divide-border text-sm">
          {roster.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
              <span className="font-medium">{r.lastName}, {r.firstName}</span>
              <span className="flex gap-3 text-[13.5px] font-medium">
                <Link href={`/students/${r.id}/performance/${term.id}`} className="text-primary">Record →</Link>
                {withReport.has(r.id) && (
                  <Link href={`/students/${r.id}/report/${term.id}`} className="text-primary">Report card →</Link>
                )}
                <Link href={`/students/${r.id}?tab=performance`} className="text-muted-foreground">Student file</Link>
              </span>
            </li>
          ))}
          {roster.length === 0 && <li className="py-2 text-muted-foreground">No active students in this class.</li>}
        </ul>
      </Card>
    </div>
  );
}
