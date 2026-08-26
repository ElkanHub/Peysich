import Link from "next/link";
import { requireModule, getCurrentTerm } from "@/core/school-context";
import { getSnapshot } from "@/modules/analytics/compute";
import { HBars, Columns, TrendLine, HeatGrid, SegBar, PILLAR, SEQ } from "@/modules/analytics/charts";
import { ghs } from "@/modules/fees/config";
import { Card, PageHeader, Empty, btnGhostCls } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";
import { refreshSnapshot } from "./actions";

const TABS = [
  { key: "", label: "Overview" }, { key: "money", label: "Money" },
  { key: "learning", label: "Learning" }, { key: "attendance", label: "Attendance" },
  { key: "people", label: "People" }, { key: "operations", label: "Operations" },
];
/** Short GHS for chart labels: 4,430,000 pesewas → "44.3k". */
const k = (p: number) => {
  const g = p / 100;
  return g >= 10000 ? `${Math.round(g / 100) / 10}k` : g.toLocaleString();
};

/** The head's instrument panel. Admins only — enforced by role here and by
 *  the Analytics grant in Team & access (path gate). Reads today's snapshot,
 *  never live tables; drill-downs land on the real pages. */
export default async function Analytics({ params, searchParams }: {
  params: Promise<{ school: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { school: slug } = await params;
  const sp = await searchParams;
  const { school } = await requireModule(slug, "analytics", ["admin"]);
  const term = await getCurrentTerm(school.id);
  const snap = await getSnapshot(school, term);
  const tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab ?? "") : "";
  const M = snap.money, L = snap.learning, A = snap.attendance, P = snap.people, O = snap.operations;
  const collectionPct = M.billed ? Math.round((M.collected / M.billed) * 100) : null;

  const Kpi = ({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) => (
    <Card className="p-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-[22px] font-bold tracking-tight ${tone ?? ""}`} data-nums="">{value}</p>
      {hint && <p className="text-[12px] text-muted-foreground" data-nums="">{hint}</p>}
    </Card>
  );
  const H = ({ children, color }: { children: React.ReactNode; color?: string }) => (
    <h2 className="mb-2.5 font-semibold" style={color ? { color } : undefined}>{children}</h2>
  );

  return (
    <div className="max-w-5xl">
      <PageHeader title="Analytics"
        sub={`${snap.termLabel} · data as of ${new Date(snap.computedAt).toISOString().slice(11, 16)} UTC, ${snap.day}`} />
      <div className="-mt-3 mb-4 flex flex-wrap items-center gap-2">
        <form action={refreshSnapshot.bind(null, slug, tab)}>
          <SubmitButton className={btnGhostCls + " px-2.5 py-1 text-[12.5px]"} pendingText="Recomputing…">
            ⟳ Refresh now
          </SubmitButton>
        </form>
        <a href={`/api/analytics/csv?tab=${tab || "overview"}`} className={btnGhostCls + " px-2.5 py-1 text-[12.5px]"}>
          Export CSV
        </a>
      </div>

      <div className="mb-5 flex flex-wrap gap-0.5 border-b-2 border-border">
        {TABS.map((t) => (
          <Link key={t.key} href={t.key ? `/analytics?tab=${t.key}` : "/analytics"}
            className={`-mb-0.5 border-b-2 px-3.5 py-2 text-[13.5px] font-semibold ${tab === t.key
              ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </Link>
        ))}
      </div>

      {!term && <Empty title="No current term" hint="Analytics needs an academic year with a running term." />}

      {/* ═══ OVERVIEW ═══ */}
      {term && tab === "" && (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Kpi label="Collection rate" value={collectionPct !== null ? `${collectionPct}%` : "—"}
              hint={M.billed ? `${ghs(M.collected)} of ${ghs(M.billed)}` : "no invoices yet"}
              tone={collectionPct !== null && collectionPct < 50 ? "text-danger" : "text-success"} />
            <Kpi label="Attendance" value={A.rate !== null ? `${A.rate}%` : "—"} hint="term to date" />
            <Kpi label="School average" value={L.schoolAvg !== null ? `${L.schoolAvg}%` : "—"}
              hint={L.studentsScored ? `${L.studentsScored} students scored` : "no marks yet"} />
            <Kpi label="At risk" value={String(L.atRisk.length)}
              hint="grades × attendance" tone={L.atRisk.length ? "text-danger" : "text-success"} />
            <Kpi label="Enrolment" value={String(P.enrolled)}
              hint={P.retention !== null ? `${P.retention}% retention` : undefined} />
          </div>
          <div className="grid items-start gap-4 md:grid-cols-2">
            <Card>
              <H color={PILLAR.money}>Collection vs billed <span className="text-[12px] font-normal text-muted-foreground">cumulative, GHS</span></H>
              <TrendLine points={M.weekly} color={PILLAR.money} fmt={(v) => k(v)}
                target={M.billed ? { v: M.billed, label: `billed · ${k(M.billed)}` } : undefined}
                forecast={M.forecast > M.collected ? { v: M.forecast, atLabel: `projected · ${k(M.forecast)}` } : undefined} />
              <p className="mt-1 text-[12px] text-muted-foreground">Solid = collected · dotted = forecast at the current weekly pace</p>
            </Card>
            <Card>
              <H color={PILLAR.attendance}>Attendance by week <span className="text-[12px] font-normal text-muted-foreground">% present</span></H>
              <TrendLine points={A.weekly} color={PILLAR.attendance} fmt={(v) => `${v}%`} yMax={100} />
            </Card>
            <Card>
              <H color={PILLAR.people}>Admissions funnel</H>
              <HBars color={PILLAR.people}
                rows={P.funnel.map((f, i) => ({
                  label: f.label, v: f.v,
                  display: i === P.funnel.length - 1 ? `${f.v} · ${P.conversion}%` : String(f.v),
                }))} />
              <Link href="/admissions" className="mt-3 inline-block text-[13px] font-medium text-primary">
                The pipeline →
              </Link>
            </Card>
            <Card>
              <H color="var(--danger)">At risk — falling grades × missed days</H>
              {L.atRisk.length ? (
                <table className="w-full text-[13px]" data-nums="">
                  <thead><tr className="text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                    <th className="py-1">Student</th><th>Class</th><th className="text-right">Avg</th><th className="text-right">Missed</th></tr></thead>
                  <tbody>
                    {L.atRisk.slice(0, 5).map((r) => (
                      <tr key={r.id} className="border-t border-border">
                        <td className="py-1.5"><Link href={`/students/${r.id}`} className="font-medium hover:text-primary">{r.name}</Link></td>
                        <td>{r.className}</td>
                        <td className={`text-right font-semibold ${(r.avg ?? 100) < 50 ? "text-danger" : "text-warning"}`}>{r.avg}%</td>
                        <td className="text-right">{r.missed} of {r.of}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="text-sm text-muted-foreground">Nobody is flagged — scores and attendance are both healthy.</p>}
              {L.atRisk.length > 5 && (
                <Link href="/analytics?tab=learning" className="mt-2 inline-block text-[13px] font-medium text-primary">
                  All {L.atRisk.length} →
                </Link>
              )}
            </Card>
          </div>
        </>
      )}

      {/* ═══ MONEY ═══ */}
      {term && tab === "money" && (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Billed this term" value={ghs(M.billed)} />
            <Kpi label="Collected" value={ghs(M.collected)} tone="text-success"
              hint={collectionPct !== null ? `${collectionPct}%` : undefined} />
            <Kpi label="Outstanding" value={ghs(M.outstanding)} tone={M.outstanding ? "text-danger" : "text-success"}
              hint={`${M.owingStudents} students owing`} />
            <Kpi label="Projected end of term" value={ghs(M.forecast)}
              hint={M.billed ? `${Math.round((M.forecast / M.billed) * 100)}% of billed` : undefined} />
          </div>
          <div className="grid items-start gap-4 md:grid-cols-2">
            <Card>
              <H color={PILLAR.money}>Outstanding by age <span className="text-[12px] font-normal text-muted-foreground">from due date</span></H>
              <HBars colors={SEQ.map((c, i) => (i === 0 ? "#C9A3B8" : SEQ[i - 1]))}
                rows={M.aging.map((a) => ({ label: a.label, v: a.v, display: k(a.v) }))} />
              <p className="mt-2 text-[12px] text-muted-foreground">
                Darker = older. 60+ is where the clearance gate and certificate holds live.
              </p>
            </Card>
            <Card>
              <H color={PILLAR.money}>How parents pay <span className="text-[12px] font-normal text-muted-foreground">recorded methods</span></H>
              <SegBar parts={M.channels.map((c, i) => ({
                label: c.label, v: c.v, display: ghs(c.v),
                color: [PILLAR.money, PILLAR.attendance, PILLAR.people, PILLAR.learning][i] ?? "#8a8a8a",
              }))} />
              <p className="mt-3 text-[12px] text-muted-foreground">
                The school collects its own money — these are the methods the office records.
              </p>
            </Card>
            <Card className="md:col-span-2">
              <H>Who owes, by class <span className="text-[12px] font-normal text-muted-foreground">click a class to open it on the fees desk</span></H>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-nums="">
                  <thead><tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="py-1">Class</th><th className="text-right">Billed</th><th className="text-right">Collected</th>
                    <th className="text-right">Outstanding</th><th className="text-right">Owing</th><th className="w-1/4 pl-3">Collection</th></tr></thead>
                  <tbody>
                    {M.byClass.map((r) => {
                      const p = r.billed ? Math.round((r.collected / r.billed) * 100) : 0;
                      return (
                        <tr key={r.classId} className="border-t border-border">
                          <td className="py-1.5">
                            <Link href={`/fees?c=${r.classId}`} className="font-medium hover:text-primary">{r.name}</Link>
                          </td>
                          <td className="text-right">{(r.billed / 100).toFixed(2)}</td>
                          <td className="text-right text-success">{(r.collected / 100).toFixed(2)}</td>
                          <td className={`text-right font-semibold ${r.outstanding ? "text-danger" : ""}`}>{(r.outstanding / 100).toFixed(2)}</td>
                          <td className="text-right">{r.owing} of {r.of}</td>
                          <td className="pl-3">
                            <span className="block h-2 overflow-hidden rounded-full bg-muted">
                              <span className="block h-full rounded-full" style={{ width: `${p}%`, background: PILLAR.money }} />
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {!M.byClass.length && <tr><td colSpan={6} className="py-3 text-muted-foreground">No invoices yet — generate them on the fees desk.</td></tr>}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}

      {/* ═══ LEARNING ═══ */}
      {term && tab === "learning" && (
        <div className="grid items-start gap-4 md:grid-cols-2">
          <Card>
            <H color={PILLAR.learning}>Subject averages
              {L.schoolAvg !== null && <span className="text-[12px] font-normal text-muted-foreground"> vs school average {L.schoolAvg}%</span>}</H>
            {L.subjects.length ? (
              <HBars color={PILLAR.learning}
                refLine={L.schoolAvg !== null ? { at: L.schoolAvg / Math.max(1, ...L.subjects.map((s) => s.avg)), label: `school avg ${L.schoolAvg}%` } : undefined}
                rows={L.subjects.map((s) => ({
                  label: s.name, v: s.avg, display: `${s.avg}%`,
                  faded: L.schoolAvg !== null && s.avg < L.schoolAvg,
                }))} />
            ) : <p className="text-sm text-muted-foreground">No marks entered this term yet.</p>}
            <p className="mt-2 text-[12px] text-muted-foreground">Faded = below the school average. Same conversion the report cards use.</p>
          </Card>
          <Card>
            <H color={PILLAR.learning}>Grade spread <span className="text-[12px] font-normal text-muted-foreground">your grading bands, all scored subjects</span></H>
            {L.grades.some((g) => g.n) ? (
              <Columns color={PILLAR.learning} bins={L.grades.map((g) => ({ label: g.grade, n: g.n }))} />
            ) : <p className="text-sm text-muted-foreground">Appears once marks are entered.</p>}
          </Card>
          <Card>
            <H color={PILLAR.learning}>Class outcomes by teacher <span className="text-[12px] font-normal text-muted-foreground">same subject only — never across subjects</span></H>
            {L.teachers.length ? (
              <table className="w-full text-[13px]" data-nums="">
                <thead><tr className="text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-1">Teacher · subject</th><th>Classes</th><th className="text-right">Avg</th><th className="text-right">vs subject</th></tr></thead>
                <tbody>
                  {L.teachers.map((t, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="py-1.5 font-medium">{t.name} · {t.subject}</td>
                      <td className="text-[12px] text-muted-foreground">{t.classes}</td>
                      <td className="text-right">{t.avg}%</td>
                      <td className={`text-right font-semibold ${t.delta >= 0 ? "text-success" : "text-danger"}`}>
                        {t.delta >= 0 ? `+${t.delta}` : t.delta}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="text-sm text-muted-foreground">Needs marks plus teaching allocations in the timetable.</p>}
          </Card>
          <Card>
            <H color="var(--danger)">At risk — all {L.atRisk.length}</H>
            {L.atRisk.length ? (
              <table className="w-full text-[13px]" data-nums="">
                <thead><tr className="text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-1">Student</th><th>Class</th><th className="text-right">Avg</th><th className="text-right">Missed</th></tr></thead>
                <tbody>
                  {L.atRisk.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="py-1.5"><Link href={`/students/${r.id}`} className="font-medium hover:text-primary">{r.name}</Link></td>
                      <td>{r.className}</td>
                      <td className={`text-right font-semibold ${(r.avg ?? 100) < 50 ? "text-danger" : "text-warning"}`}>{r.avg}%</td>
                      <td className="text-right">{r.missed} of {r.of}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="text-sm text-muted-foreground">Nobody flagged. The bar: average below 55% AND more than 10% of days missed.</p>}
            <p className="mt-2 text-[12px] text-muted-foreground">Open the student file for the class teacher and guardian contacts.</p>
          </Card>
        </div>
      )}

      {/* ═══ ATTENDANCE ═══ */}
      {term && tab === "attendance" && (
        <div className="grid items-start gap-4 md:grid-cols-2">
          <Card className="md:col-span-2">
            <H color={PILLAR.attendance}>Attendance by week <span className="text-[12px] font-normal text-muted-foreground">% present · term to date {A.rate ?? "—"}%</span></H>
            <TrendLine points={A.weekly} color={PILLAR.attendance} fmt={(v) => `${v}%`} yMax={100} />
          </Card>
          <Card>
            <H color={PILLAR.attendance}>Absence heat <span className="text-[12px] font-normal text-muted-foreground">class × weekday, darker = worse</span></H>
            {A.heat.rows.length ? (
              <HeatGrid rows={A.heat.rows} cols={A.heat.cols} cells={A.heat.cells}
                color={PILLAR.attendance} links={A.heat.rowIds.map((id) => `/attendance/${id}`)} />
            ) : <p className="text-sm text-muted-foreground">Appears once registers are marked.</p>}
          </Card>
          <div className="space-y-4">
            <Card>
              <H color={PILLAR.attendance}>Late arrivals by weekday</H>
              {A.lateByDay.some((d) => d.v) ? (
                <Columns color={PILLAR.attendance} bins={A.lateByDay.map((d) => ({ label: d.label, n: d.v }))} />
              ) : <p className="text-sm text-muted-foreground">No lates recorded this term.</p>}
            </Card>
            <Card>
              <H color="var(--danger)">Chronic absentees <span className="text-[12px] font-normal text-muted-foreground">&gt;10% of marked days</span></H>
              {A.chronic.length ? (
                <ul className="divide-y divide-border text-[13px]" data-nums="">
                  {A.chronic.map((r) => (
                    <li key={r.id} className="flex items-center justify-between py-1.5">
                      <Link href={`/students/${r.id}`} className="font-medium hover:text-primary">{r.name}
                        <span className="ml-2 font-normal text-muted-foreground">{r.className}</span></Link>
                      <span className="font-semibold text-danger">{r.missed} of {r.of}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">Nobody over the threshold ✓</p>}
            </Card>
          </div>
        </div>
      )}

      {/* ═══ PEOPLE ═══ */}
      {term && tab === "people" && (
        <div className="grid items-start gap-4 md:grid-cols-2">
          <Card>
            <H color={PILLAR.people}>Admissions funnel <span className="text-[12px] font-normal text-muted-foreground">{P.conversion}% applied → admitted</span></H>
            <HBars color={PILLAR.people}
              rows={P.funnel.map((f) => ({ label: f.label, v: f.v, display: String(f.v) }))} />
            <Link href="/admissions" className="mt-3 inline-block text-[13px] font-medium text-primary">The pipeline →</Link>
          </Card>
          <Card>
            <H color={PILLAR.people}>Why students left <span className="text-[12px] font-normal text-muted-foreground">this year{P.retention !== null ? ` · retention ${P.retention}%` : ""}</span></H>
            {P.exits.length ? (
              <HBars color={PILLAR.people}
                rows={P.exits.map((e) => ({ label: e.reason, v: e.n, display: String(e.n) }))} />
            ) : <p className="text-sm text-muted-foreground">No exits recorded this year ✓</p>}
          </Card>
          <Card>
            <H color={PILLAR.people}>Who our students are</H>
            <p className="mb-1.5 text-[12px] text-muted-foreground">Girls / boys</p>
            <SegBar parts={[
              { label: "Girls", v: P.gender.female, color: PILLAR.money, display: `${P.gender.female}` },
              { label: "Boys", v: P.gender.male, color: PILLAR.attendance, display: `${P.gender.male}` },
            ]} />
            <table className="mt-3 w-full text-[13px]" data-nums="">
              <tbody>
                <tr className="border-t border-border"><td className="py-1.5">On school transport</td>
                  <td className="text-right font-medium">{P.transportRiders} riders</td></tr>
                <tr className="border-t border-border"><td className="py-1.5">Guardians on file (SMS-reachable)</td>
                  <td className="text-right font-medium text-success">{P.smsReachablePct !== null ? `${P.smsReachablePct}%` : "—"}</td></tr>
              </tbody>
            </table>
          </Card>
          <Card>
            <H color={PILLAR.people}>Enrolment by level {P.seats.length > 0 && <span className="text-[12px] font-normal text-muted-foreground">vs seats</span>}</H>
            <HBars color={PILLAR.people}
              rows={P.byLevel.map((l) => {
                const seat = P.seats.find((s) => s.name === l.name);
                return { label: l.name, v: l.n, display: seat ? `${l.n} of ${seat.cap}` : String(l.n) };
              })} />
            {!P.seats.length && (
              <p className="mt-2 text-[12px] text-muted-foreground">
                Set seats per level in <Link href="/admissions/setup" className="font-medium text-primary">Intake settings</Link> to see capacity here.
              </p>
            )}
          </Card>
        </div>
      )}

      {/* ═══ OPERATIONS ═══ */}
      {term && tab === "operations" && (
        <div className="grid items-start gap-4 md:grid-cols-2">
          <Card>
            <H>Teacher load <span className="text-[12px] font-normal text-muted-foreground">from the timetable · school average {O.avgPeriods}/wk</span></H>
            {O.teacherLoad.length ? (
              <table className="w-full text-[13px]" data-nums="">
                <thead><tr className="text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-1">Teacher</th><th className="text-right">Periods/wk</th><th className="text-right">Students</th></tr></thead>
                <tbody>
                  {O.teacherLoad.map((t, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="py-1.5 font-medium">{t.name}</td>
                      <td className={`text-right ${O.avgPeriods && t.periods > O.avgPeriods * 1.25 ? "font-semibold text-danger" : ""}`}>{t.periods}</td>
                      <td className="text-right">{t.students}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="text-sm text-muted-foreground">Build the timetable to see who carries what.</p>}
            <p className="mt-2 text-[12px] text-muted-foreground">Red = more than 25% above the school average.</p>
          </Card>
          <div className="space-y-4">
            <Card>
              <H>Library</H>
              <table className="w-full text-[13px]" data-nums="">
                <tbody>
                  <tr><td className="py-1.5">Copies in the library</td><td className="text-right font-medium">{O.library.books}</td></tr>
                  <tr className="border-t border-border"><td className="py-1.5">Out on loan</td><td className="text-right font-medium">{O.library.out}</td></tr>
                  <tr className="border-t border-border"><td className="py-1.5">Overdue (3+ weeks)</td>
                    <td className={`text-right font-medium ${O.library.overdue ? "text-danger" : "text-success"}`}>{O.library.overdue}</td></tr>
                </tbody>
              </table>
            </Card>
            <Card>
              <H>Transport routes</H>
              {O.routes.length ? (
                <HBars color={PILLAR.attendance}
                  rows={O.routes.map((r) => ({ label: r.name, v: r.riders, display: `${r.riders} riders` }))} />
              ) : <p className="text-sm text-muted-foreground">No routes set up in the Transport tab.</p>}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
