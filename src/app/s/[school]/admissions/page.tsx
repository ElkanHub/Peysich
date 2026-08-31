import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { applicants, applicantGuardians, levels, classes, students, guardians } from "@/db/schema";
import { requireModule } from "@/core/school-context";
import { getIntakeConfig, parseDocs, STAGES, STAGE_LABEL } from "@/modules/admissions/config";
import { Card, PageHeader, Empty } from "@/ui/kit";

/** The admissions desk — a pipeline, not a table. Every applicant sits in
 *  exactly one stage; days-in-stage keeps anyone from being forgotten. */
export default async function Admissions({ params, searchParams }: {
  params: Promise<{ school: string }>;
  searchParams: Promise<{ lvl?: string; q?: string }>;
}) {
  const { school: slug } = await params;
  const sp = await searchParams;
  const { school } = await requireModule(slug, "admissions", ["admin"]);
  const cfg = getIntakeConfig(school.settings);

  const [rows, lvs, cls, roster, allGuardians, apgRows] = await Promise.all([
    db.select().from(applicants).where(eq(applicants.schoolId, school.id)),
    db.select().from(levels).where(eq(levels.schoolId, school.id)).orderBy(levels.sortOrder),
    db.select().from(classes).where(eq(classes.schoolId, school.id)),
    db.select({ id: students.id, classId: students.classId }).from(students)
      .where(and(eq(students.schoolId, school.id), eq(students.status, "active"))),
    db.select({ phone: guardians.phone }).from(guardians).where(eq(guardians.schoolId, school.id)),
    db.select({ applicantId: applicantGuardians.applicantId, phone: applicantGuardians.phone })
      .from(applicantGuardians).where(eq(applicantGuardians.schoolId, school.id)),
  ]);
  const levelName = new Map(lvs.map((l) => [l.id, l.name]));
  const classLevel = new Map(cls.map((c) => [c.id, c.levelId]));
  const knownPhones = new Set(allGuardians.map((g) => g.phone).filter(Boolean));
  const apgPhones = new Map<string, string[]>();
  for (const r of apgRows) {
    if (!apgPhones.has(r.applicantId)) apgPhones.set(r.applicantId, []);
    apgPhones.get(r.applicantId)!.push(r.phone);
  }
  const hasSibling = (a: { id: string; guardianPhone: string }) =>
    [a.guardianPhone, ...(apgPhones.get(a.id) ?? [])].some((ph) => ph && knownPhones.has(ph));
  const enrolledByLevel = new Map<string, number>();
  for (const s of roster) {
    const lid = s.classId ? classLevel.get(s.classId) : null;
    if (lid) enrolledByLevel.set(lid, (enrolledByLevel.get(lid) ?? 0) + 1);
  }
  const seatsLeft = lvs.reduce((acc, l) => {
    const cap = cfg.seats[l.id];
    return cap ? acc + Math.max(0, cap - (enrolledByLevel.get(l.id) ?? 0)) : acc;
  }, 0);
  const hasSeats = Object.keys(cfg.seats).length > 0;

  const q = (sp.q ?? "").toLowerCase();
  const shown = rows
    .filter((a) => !sp.lvl || a.levelId === sp.lvl)
    .filter((a) => !q || a.name.toLowerCase().includes(q) || a.guardianPhone.includes(q))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const byStage = (s: string) => shown.filter((a) => a.status === s);
  const inPipeline = rows.filter((a) => !["waitlist", "rejected"].includes(a.status));
  const admitted = rows.filter((a) => a.status === "admitted").length;
  const conversion = inPipeline.length ? Math.round((admitted / inPipeline.length) * 100) : 0;
  const days = (d: Date) => Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
  const docsMissing = (a: typeof rows[number]) => {
    const got = parseDocs(a.docs);
    return cfg.docs.some((d) => !got[d.key]);
  };

  const kpi = (label: string, value: string, hint?: string, tone?: string) => (
    <Card key={label} className="p-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-[22px] font-bold tracking-tight ${tone ?? ""}`} data-nums="">{value}</p>
      {hint && <p className="text-[12px] text-muted-foreground">{hint}</p>}
    </Card>
  );

  return (
    <div className="max-w-5xl">
      <PageHeader title="Admissions"
        sub={cfg.open
          ? `Accepting applications${cfg.closesOn ? ` · close ${cfg.closesOn}` : ""}`
          : "Applications are closed — open the season under Intake settings"}
        action={{ href: "/admissions/new", label: "+ New application" }} />
      <p className="-mt-3 mb-4">
        <Link href="/admissions/setup" className="text-[13.5px] font-medium text-primary">Intake settings →</Link>
      </p>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpi("Applications", String(inPipeline.length), `${byStage("new").length} new`)}
        {kpi("In screening", String(rows.filter((a) => a.status === "screening").length))}
        {kpi("Offers out", String(rows.filter((a) => a.status === "offer").length))}
        {kpi("Admitted", String(admitted), `${conversion}% conversion`, "text-success")}
        {kpi("Seats left", hasSeats ? String(seatsLeft) : "—",
          hasSeats ? undefined : "set capacity in Intake settings")}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <Link href="/admissions" className={`rounded-full px-3 py-1 text-[13px] font-medium ${!sp.lvl
          ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted"}`}>
          All levels
        </Link>
        {lvs.filter((l) => rows.some((a) => a.levelId === l.id)).map((l) => (
          <Link key={l.id} href={`/admissions?lvl=${l.id}`}
            className={`rounded-full px-3 py-1 text-[13px] font-medium ${sp.lvl === l.id
              ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted"}`}>
            {l.name}
          </Link>
        ))}
        <form className="ml-auto" action="/admissions">
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Search name or phone…"
            className="rounded-full border border-border bg-card px-3.5 py-1.5 text-[13px] outline-none focus:border-primary" />
        </form>
      </div>

      {rows.length === 0 ? (
        <Empty title="No applications yet"
          hint="Add the first one — a walk-in takes 30 seconds with just a name, level and guardian phone." />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {STAGES.map((stage) => {
            const list = byStage(stage);
            return (
              <div key={stage} className="rounded-lg border border-border bg-muted/50 p-2.5">
                <p className="mb-2 flex items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {STAGE_LABEL[stage]}
                  <span className="rounded-full border border-border bg-card px-2 text-[11px]" data-nums="">{list.length}</span>
                </p>
                <div className="space-y-2">
                  {list.slice(0, 8).map((a) => (
                    <Link key={a.id} href={`/admissions/${a.id}`}
                      className="block rounded-md border border-border bg-card p-2.5 shadow-[var(--shadow-sm)] transition-colors hover:border-primary/50">
                      <p className="text-[13.5px] font-semibold leading-tight">{a.name}</p>
                      <p className="text-[11.5px] text-muted-foreground" data-nums="">
                        {levelName.get(a.levelId) ?? "—"} · {a.guardianPhone}
                      </p>
                      <p className="mt-1.5 flex flex-wrap gap-1">
                        {stage === "admitted" && a.admittedStudentId ? (
                          <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10.5px] font-semibold text-success">student file →</span>
                        ) : (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground" data-nums="">
                            {days(a.stageAt) === 0 ? "today" : `${days(a.stageAt)}d in stage`}
                          </span>
                        )}
                        {stage !== "admitted" && docsMissing(a) && (
                          <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[10.5px] font-semibold text-danger">docs missing</span>
                        )}
                        {stage !== "admitted" && hasSibling(a) && (
                          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10.5px] font-semibold text-primary">sibling here</span>
                        )}
                        {stage === "offer" && a.offerDeadline && (
                          <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[10.5px] font-semibold text-warning" data-nums="">
                            accept by {a.offerDeadline}
                          </span>
                        )}
                        {stage === "screening" && a.interviewAt && (
                          <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[10.5px] font-semibold text-warning" data-nums="">
                            interview {a.interviewAt}
                          </span>
                        )}
                        {stage === "screening" && a.testScore !== null && (
                          <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10.5px] font-semibold text-success" data-nums="">
                            test {a.testScore}/{cfg.testMax}
                          </span>
                        )}
                      </p>
                    </Link>
                  ))}
                  {list.length > 8 && (
                    <p className="px-1 text-[12px] text-muted-foreground" data-nums="">+ {list.length - 8} more…</p>
                  )}
                  {list.length === 0 && <p className="px-1 py-2 text-[12px] text-faint">empty</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(byStage("waitlist").length > 0 || byStage("rejected").length > 0) && (
        <details className="mt-4">
          <summary className="cursor-pointer text-[13.5px] font-medium text-muted-foreground">
            Waitlisted {byStage("waitlist").length} · Rejected {byStage("rejected").length} — show
          </summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {[...byStage("waitlist"), ...byStage("rejected")].map((a) => (
              <Link key={a.id} href={`/admissions/${a.id}`}
                className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-[13px] hover:border-primary/50">
                <span className="font-medium">{a.name}
                  <span className="ml-2 text-muted-foreground">{levelName.get(a.levelId)}</span></span>
                <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${a.status === "waitlist"
                  ? "bg-warning-soft text-warning" : "bg-danger/10 text-danger"}`}>
                  {STAGE_LABEL[a.status]}
                </span>
              </Link>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
