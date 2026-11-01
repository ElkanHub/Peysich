import Link from "next/link";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { students, scorePublications, scoreSheets, reportCards, levels, terms, academicYears, user } from "@/db/schema";
import { requireModule, getCurrentTerm } from "@/core/school-context";
import { termState } from "@/core/terms";
import { TermBanner } from "@/ui/term-banner";
import { getStructure, SECTIONS, SECTION_LABELS, type Section } from "@/core/academics";
import { getReportConfig, REPORT_CONFIG_LABELS, REPORT_CONFIG_DEFAULTS, type ReportConfig } from "@/modules/assessment/report-config";
import { Card, PageHeader, Badge, Empty, btnCls, btnGhostCls } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";
import { ConfirmButton } from "@/ui/confirm";
import { cn } from "@/lib/utils";
import { releaseComponent, releaseTermReports, releasePreschoolReports, saveReportConfig, unlockScores } from "./actions";
import { skillRatings } from "@/db/schema";
import { inArray } from "drizzle-orm";

/** One send: what it is, where it stands, what is holding it, the button.
 *  A bordered row that stacks on a phone and lines up on a desktop. */
function SendRow({ title, sent, status, waiting, action, note }: {
  title: string; sent?: React.ReactNode; status?: React.ReactNode; waiting?: React.ReactNode;
  action?: React.ReactNode; note?: React.ReactNode;
}) {
  return (
    <li className="list-none rounded-lg border border-border bg-card p-3.5 sm:flex sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[15px] font-semibold">{title}</span>
          {sent ? <Badge tone="success">sent ✓</Badge> : status}
        </div>
        {sent && <p className="mt-0.5 text-[13.5px] text-muted-foreground">{sent}</p>}
        {waiting && <p className="mt-1 text-[13.5px] text-muted-foreground">{waiting}</p>}
        {note && <p className="mt-1 text-[13px] text-muted-foreground">{note}</p>}
      </div>
      {action && <div className="mt-3 shrink-0 sm:mt-0 [&_button]:w-full sm:[&_button]:w-auto">{action}</div>}
    </li>
  );
}
/** "every class ready" / "3 of 5 classes ready" as a pill. */
function Ready({ n, of }: { n: number; of: number }) {
  const all = n === of && of > 0;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ${all ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`} data-nums="">
      {all ? "every class ready" : `${n} of ${of} classes ready`}
    </span>
  );
}

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
  if (!current) return <div><PageHeader title="Report cards" sub="No current term" />
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
  // a class is "fully marked" for report cards when every component of its
  // section (tests + exam) is submitted for every subject it studies
  const classFullyMarked = (cl: { id: string; levelId: string }) =>
    S.componentsFor(S.sectionOfClass(cl)).every((c) => classReady(cl.id, c.id).ready);
  const unmarked = testClasses.filter((cl) => !classFullyMarked(cl)).map((cl) => cl.name);
  const [parentRow] = await db.select({ n: sql<number>`count(*)` }).from(user)
    .where(and(eq(user.schoolId, school.id), eq(user.role, "parent")));
  const parents = Number(parentRow?.n ?? 0);
  // at least 44px tall on a phone; the desktop kit size above that
  const bigBtn = cn(btnCls, "h-11 sm:h-9");
  const bigGhost = cn(btnGhostCls, "h-11 sm:h-9 disabled:pointer-events-none disabled:opacity-55");

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
      <PageHeader title="Report cards"
        sub={`${yearName.get(term.yearId)} · ${term.name} · what families receive — sent per test, tracked separately`} />

      {/* records are term-scoped and year-scoped — every past term stays reachable */}
      <div className="chip-row mb-4 flex flex-wrap items-center gap-2">
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
      {viewingPast && <TermBanner term={{ ...term, state: termState(term), year: { name: yearName.get(term.yearId) ?? "" } }} />}

      {/* ── sent to parents: one row per test, its own state, nothing blurred ── */}
      {/* ── sent to parents: one bordered row per send, same shape every time ── */}
      <section className="mb-6">
        <div className="mb-2.5 flex items-baseline justify-between gap-3">
          <h2 className="text-[16px] font-semibold">{viewingPast ? `Sent to parents in ${term.name}` : "Sent to parents this term"}</h2>
          <Link href="/assessment/matrix" className="shrink-0 text-[13.5px] font-medium text-primary">Missing scores →</Link>
        </div>
        <p className="mb-3 text-[13.5px] text-muted-foreground">
          Each test goes out on its own, with the child&apos;s full record. There is no un-send.
        </p>
        <ul className="space-y-2.5">
          {testSections.map((sec) => (
            S.componentsFor(sec as Section).filter((c) => !c.isExam).map((c) => {
              const secClasses = testClasses.filter((cl) => S.sectionOfClass(cl) === sec);
              const readiness = secClasses.map((cl) => ({ cl, ...classReady(cl.id, c.id) }));
              const readyCount = readiness.filter((r) => r.ready).length;
              const gaps = readiness.filter((r) => !r.ready);
              const allReady = secClasses.length > 0 && gaps.length === 0;
              const p = pubBy.get(c.id);
              return (
                <SendRow key={`${sec}:${c.id}`} title={`${SECTION_LABELS[sec as Section]} · ${c.name}`}
                  sent={p ? <>{fmtDate(p.publishedAt)} by {p.publishedBy}</> : undefined}
                  status={<Ready n={readyCount} of={secClasses.length} />}
                  waiting={!p && gaps.length > 0 ? <>Waiting on {gaps.map((g) => `${g.cl.name} (${g.done}/${g.total})`).join(", ")}</> : undefined}
                  action={!p && !viewingPast ? (
                    <form action={releaseComponent.bind(null, slug, c.id)}>
                      <ConfirmButton className={bigGhost} disabled={!allReady}
                        title={`Send ${c.name} results to ${parents} parents?`}
                        body="Every class has submitted. Parents get a message; there is no un-send."
                        confirmLabel="Send">
                        Send to parents
                      </ConfirmButton>
                    </form>
                  ) : undefined} />
              );
            })
          ))}

          {/* preschool — skills-based, so their send IS the end-of-term report card */}
          {preClasses.length > 0 && (
            <SendRow title="Preschool · skills report"
              sent={preReleased.length > 0 ? <>{preReleased.length} of {preKidIds.length} children{preReleasedAt ? ` · ${fmtDate(preReleasedAt)}` : ""}</> : undefined}
              status={<span className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ${ratedCount === preKidIds.length && preKidIds.length > 0 ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`} data-nums="">{ratedCount} of {preKidIds.length} rated</span>}
              note="Children with nothing rated yet are skipped; the term stays open."
              action={!viewingPast ? (
                <form action={releasePreschoolReports.bind(null, slug)}>
                  <ConfirmButton className={bigGhost}
                    title={`Send preschool skills reports to ${parents} parents?`}
                    body={`${ratedCount} of ${preKidIds.length} children have been rated; children with nothing rated are skipped. Parents get a message.`}
                    confirmLabel="Send">
                    {preReleased.length ? "Send again" : "Send to parents"}
                  </ConfirmButton>
                </form>
              ) : undefined} />
          )}

          {/* end-of-term report card — its own, separate send */}
          <SendRow title="End-of-term report card"
            sent={reportsN > 0 ? <>{reportsN} report cards with families{term.scoresLocked ? " · scores locked" : " · scores unlocked"}</> : undefined}
            status={<Ready n={testClasses.length - unmarked.length} of={testClasses.length} />}
            waiting={unmarked.length > 0 ? <>Not fully marked: {unmarked.join(", ")}</> : undefined}
            note="Works out class work + exam totals, locks the term's scores, and includes the preschool reports."
            action={!viewingPast ? (
              <form action={releaseTermReports.bind(null, slug)}>
                <ConfirmButton className={reportsN ? bigGhost : bigBtn}
                  title={`Send ${term.name} report cards to parents?`}
                  body={`${testClasses.length + preClasses.length} classes.${unmarked.length
                    ? ` ${unmarked.join(", ")} ${unmarked.length === 1 ? "is" : "are"} not fully marked and will go out incomplete.` : ""} Scores lock after this. ${parents} parents get a message.`}
                  confirmLabel="Send" cancelLabel="Wait">
                  {reportsN ? "Send again" : "Send report cards"}
                </ConfirmButton>
              </form>
            ) : undefined} />
        </ul>

        <div>
          <div>
            {/* unlock — the lock is on the term, so this reopens every class; the
                class named here is what the audit line records */}
            {!viewingPast && term.scoresLocked && (
              <form action={unlockScores.bind(null, slug)} className="mt-3 rounded-lg border border-border bg-muted/40 p-3">
                <p className="text-[14px] font-semibold">Unlock a class</p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  Need to change a score after sending? Scores are locked for the whole term, so
                  unlocking reopens every class — say which one and why; it is written down with your
                  name and the time. Send the report cards again when the change is done.
                </p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
                  <label className="flex flex-col gap-1 text-[13px] font-medium">
                    Which class?
                    <select name="classId" className="h-11 rounded-md border border-border bg-card px-2 text-sm font-normal sm:h-9">
                      {allClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-1 flex-col gap-1 text-[13px] font-medium">
                    Why?
                    <input name="reason" required maxLength={200} placeholder="e.g. Maths exam mark entered wrongly for Ama"
                      className="h-11 rounded-md border border-border bg-card px-2 text-sm font-normal sm:h-9" />
                  </label>
                  <SubmitButton className={bigGhost} pendingText="Unlocking…">Unlock scores</SubmitButton>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

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
          <SubmitButton className={cn(bigBtn, "mt-3")} pendingText="Saving…">Save design</SubmitButton>
        </form>
      </Card>

      {/* ── read-only records browser ── */}
      <Card>
        <h2 className="font-semibold">The records</h2>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          Open any child&apos;s record exactly as it prints. Reading only — marks are edited under Assessment.
        </p>
        <div className="chip-row mt-3 flex flex-wrap gap-1.5">
          {allClasses.map((c) => (
            <Link key={c.id} href={`?c=${c.id}&t=${term.id}`}
              className={`inline-flex min-h-11 items-center rounded-md border px-3 text-[13.5px] font-medium sm:min-h-0 sm:py-1 ${c.id === activeClass?.id
                ? "border-primary/40 bg-brand-container text-on-brand-container" : "border-border hover:bg-muted"}`}>
              {c.name}
            </Link>
          ))}
        </div>
        <ul className="mt-3 divide-y divide-border text-sm">
          {roster.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5">
              <span className="font-medium">{r.lastName}, {r.firstName}</span>
              <span className="flex gap-3 text-[13.5px] font-medium max-sm:basis-full">
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
