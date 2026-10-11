import Link from "next/link";
import { db } from "@/db";
import { schools } from "@/db/schema";
import { requireConsole } from "@/core/console";
import { STREAM_COLORS, STREAM_WORDS, ghs, lastMonths, monthKey, monthLabel, mrrSeries, revenueEvents, revenueTarget, type Stream } from "@/core/finance";
import { PILLAR, SegBar, TrendLine, HBars } from "@/modules/analytics/charts";
import { Card, DataTable, PageHeader, Stat, Tabs, Tr, Td, btnGhostCls } from "@/ui/kit";
import { FilterSelect, Pagination } from "@/ui/list-controls";

const PER = 25;

/** Financials (docs/12 §2): what came in and from where, the recurring base,
 *  the trend against the target, and every transaction with its reference. */
export default async function Financials({ searchParams }: {
  searchParams: Promise<{ page?: string; school?: string; stream?: string }>;
}) {
  await requireConsole("financials");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const months = lastMonths(12);
  const [events, mrr, target, allSchools] = await Promise.all([revenueEvents(), mrrSeries(months), revenueTarget(),
    db.select({ id: schools.id, name: schools.name }).from(schools).orderBy(schools.name)]);
  const name = new Map(allSchools.map((s) => [s.id, s.name]));
  const thisMonth = monthKey(new Date()), thisYear = thisMonth.slice(0, 4);
  const sum = (xs: { pesewas: number }[]) => xs.reduce((a, e) => a + e.pesewas, 0);
  const inMonth = events.filter((e) => monthKey(e.at) === thisMonth);
  const lastMonth = events.filter((e) => monthKey(e.at) === months[months.length - 2]);
  const ytd = events.filter((e) => e.at.toISOString().startsWith(thisYear));
  const byMonth = months.map((m) => ({ label: monthLabel(m), v: sum(events.filter((e) => monthKey(e.at) === m)) }));
  const streams = (["plan", "messaging", "installation"] as Stream[]).map((s) => ({
    label: STREAM_WORDS[s], v: sum(ytd.filter((e) => e.stream === s)), color: STREAM_COLORS[s], display: ghs(sum(ytd.filter((e) => e.stream === s))),
  }));
  const topSchools = [...events.reduce((m, e) => m.set(e.schoolId, (m.get(e.schoolId) ?? 0) + e.pesewas), new Map<string, number>())]
    .sort((a, b) => b[1] - a[1]).slice(0, 8);
  const filtered = events.filter((e) => (!sp.school || e.schoolId === sp.school) && (!sp.stream || e.stream === sp.stream));
  const slice = filtered.slice((page - 1) * PER, page * PER);
  const change = lastMonth.length ? Math.round(((sum(inMonth) - sum(lastMonth)) / Math.max(1, sum(lastMonth))) * 100) : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Financials" sub="What came in, from where, and the recurring base"
        action={<a href="/api/export/finance" className={btnGhostCls} download>Export all transactions (CSV)</a>} />
      <Tabs active="overview" tabs={[
        { key: "overview", label: "Overview", href: "/platform/financials" },
        { key: "analytics", label: "Analytics", href: "/platform/financials/analytics" },
        { key: "schools", label: "By school", href: "/platform/financials/schools" },
      ]} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="This month" value={ghs(sum(inMonth))} tone="success"
          hint={change === null ? `${inMonth.length} transactions` : `${change >= 0 ? "+" : ""}${change}% on last month`} />
        <Stat label="MRR" value={ghs(mrr.nowMrr)} hint={`${mrr.paying} paying school${mrr.paying === 1 ? "" : "s"} · ARPU ${ghs(mrr.arpu)}`} />
        <Stat label="ARR run-rate" value={ghs(mrr.nowMrr * 12)} hint="MRR × 12" />
        <Stat label="This year" value={ghs(sum(ytd))} hint={`all time ${ghs(sum(events))}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">Revenue by month</h2>
            {target > 0 && <span className="text-[12.5px] text-muted-foreground">target {ghs(target)} a month · <Link href="/platform/settings" className="text-primary">change</Link></span>}
          </div>
          <div className="mt-3">
            <TrendLine points={byMonth} color={PILLAR.money} fmt={ghs} target={target > 0 ? { v: target, label: "target" } : undefined} />
          </div>
          {target === 0 && <p className="mt-2 text-[12.5px] text-muted-foreground">Set a monthly target under <Link href="/platform/settings" className="text-primary">Settings</Link> and it draws here.</p>}
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="font-semibold">By stream, this year</h2>
          <div className="mt-3"><SegBar parts={streams} /></div>
          <h3 className="mt-5 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">Top schools, all time</h3>
          <div className="mt-2">
            <HBars color={PILLAR.money} rows={topSchools.map(([id, v]) => ({ label: name.get(id) ?? "—", v, display: ghs(v) }))} />
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Transactions</h2>
          <div className="flex gap-2">
            <FilterSelect name="school" allLabel="Every school" options={allSchools.map((s) => ({ value: s.id, label: s.name }))} />
            <FilterSelect name="stream" allLabel="Every stream" options={(Object.keys(STREAM_WORDS) as Stream[]).map((s) => ({ value: s, label: STREAM_WORDS[s] }))} />
          </div>
        </div>
        <div className="mt-3">
          <DataTable head={["Date", "School", "Stream", "Detail", "Reference", "Amount"]}>
            {slice.map((e) => (
              <Tr key={e.reference + e.at.toISOString()}>
                <Td className="whitespace-nowrap text-muted-foreground" data-nums="">{e.at.toISOString().slice(0, 10)}</Td>
                <Td><Link href={`/platform/financials/schools/${e.schoolId}`} className="font-medium text-primary hover:underline">{name.get(e.schoolId) ?? "—"}</Link></Td>
                <Td><span className="inline-flex items-center gap-1.5 text-[13px]"><i className="h-2.5 w-2.5 rounded-[3px]" style={{ background: STREAM_COLORS[e.stream] }} />{STREAM_WORDS[e.stream]}</span></Td>
                <Td className="max-w-[22rem] truncate text-[13px] text-muted-foreground">{e.detail}</Td>
                <Td className="font-mono text-[12px] text-muted-foreground">{e.reference.slice(0, 28)}</Td>
                <Td className="whitespace-nowrap font-semibold" data-nums="">{ghs(e.pesewas)}</Td>
              </Tr>
            ))}
          </DataTable>
          {filtered.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No transactions match.</p>}
          <Pagination page={page} count={filtered.length} perPage={PER} />
        </div>
      </Card>
    </div>
  );
}
