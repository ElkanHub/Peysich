import Link from "next/link";
import { requireConsole } from "@/core/console";
import { cohorts, funnel, ghs, lastMonths, messagingEconomics, monthLabel, mrrSeries, renewals, revenueTarget, revenueEvents, monthKey } from "@/core/finance";
import { Columns, HBars, PILLAR, SEQ, TrendLine } from "@/modules/analytics/charts";
import { Badge, Card, DataTable, PageHeader, Stat, Tabs, Tr, Td } from "@/ui/kit";

/** The money, broken down (docs/12 §2): the recurring base and its movement,
 *  the funnel, renewals, messaging economics and signup cohorts. Every chart
 *  sits beside its numbers. */
export default async function FinanceAnalytics() {
  await requireConsole("financials");
  const months = lastMonths(12);
  const [mrr, fun, ren, eco, coh, events, target] = await Promise.all([
    mrrSeries(months), funnel(), renewals(), messagingEconomics(months), cohorts(months), revenueEvents(), revenueTarget(),
  ]);
  const last = mrr.series.at(-1)!;
  const pct = (a: number, b: number) => b ? `${Math.round((a / b) * 100)}%` : "—";
  const ym = (d: Date) => d.toISOString().slice(0, 10);
  const thisMonthRevenue = events.filter((e) => monthKey(e.at) === months.at(-1)).reduce((a, e) => a + e.pesewas, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Financial analytics" sub="The recurring base, the funnel, renewals, messaging economics and cohorts" />
      <Tabs active="analytics" tabs={[
        { key: "overview", label: "Overview", href: "/platform/financials" },
        { key: "analytics", label: "Analytics", href: "/platform/financials/analytics" },
        { key: "schools", label: "By school", href: "/platform/financials/schools" },
      ]} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="MRR now" value={ghs(mrr.nowMrr)} tone="success" hint={`${mrr.paying} paying · ARPU ${ghs(mrr.arpu)}`} />
        <Stat label="MRR movement, this month" value={`${last.added + last.expansion - last.contraction - last.churned >= 0 ? "+" : "−"}${ghs(Math.abs(last.added + last.expansion - last.contraction - last.churned))}`}
          hint={`new ${ghs(last.added)} · churn ${ghs(last.churned)}`} tone={last.churned > last.added ? "danger" : "default"} />
        <Stat label="Target progress" value={target ? pct(thisMonthRevenue, target) : "—"} hint={target ? `${ghs(thisMonthRevenue)} of ${ghs(target)}` : "no target set"} />
        <Stat label="Trial → paid" value={pct(fun.paidEver, fun.signedUp)} hint={fun.medianDaysToPay !== null ? `median ${fun.medianDaysToPay} days to first payment` : "no payment yet"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold">MRR, 12 months</h2>
          <div className="mt-3"><TrendLine points={mrr.series.map((m) => ({ label: monthLabel(m.month), v: m.mrr }))} color={PILLAR.money} fmt={ghs} /></div>
          <h3 className="mt-4 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">Movement</h3>
          <div className="mt-2">
            <DataTable head={["Month", "Schools", "New", "Expansion", "Contraction", "Churn", "MRR"]}>
              {[...mrr.series].reverse().slice(0, 6).map((m) => (
                <Tr key={m.month}>
                  <Td className="text-muted-foreground">{monthLabel(m.month)}</Td>
                  <Td data-nums="">{m.schools}</Td>
                  <Td className="text-success" data-nums="">{m.added ? ghs(m.added) : "—"}</Td>
                  <Td className="text-success" data-nums="">{m.expansion ? ghs(m.expansion) : "—"}</Td>
                  <Td className="text-warning" data-nums="">{m.contraction ? ghs(m.contraction) : "—"}</Td>
                  <Td className="text-danger" data-nums="">{m.churned ? ghs(m.churned) : "—"}</Td>
                  <Td className="font-semibold" data-nums="">{ghs(m.mrr)}</Td>
                </Tr>
              ))}
            </DataTable>
          </div>
        </Card>
        <Card>
          <h2 className="font-semibold">The funnel</h2>
          <div className="mt-3">
            <HBars colors={SEQ.concat(SEQ)} rows={[
              { label: "Signed up", v: fun.signedUp, display: String(fun.signedUp) },
              { label: "Set up", v: fun.setUp, display: `${fun.setUp} · ${pct(fun.setUp, fun.signedUp)}` },
              { label: "Live", v: fun.live, display: `${fun.live} · ${pct(fun.live, fun.signedUp)}` },
              { label: "Paid ever", v: fun.paidEver, display: `${fun.paidEver} · ${pct(fun.paidEver, fun.signedUp)}` },
              { label: "Paying now", v: fun.payingNow, display: `${fun.payingNow} · ${pct(fun.payingNow, fun.signedUp)}` },
              { label: "Lapsed", v: fun.lapsed, display: String(fun.lapsed), faded: true },
            ]} />
          </div>
          <p className="mt-3 text-[12.5px] text-muted-foreground">Set up = has students on roll. Live = has marked a register. Lapsed = suspended or expired.</p>
          <h3 className="mt-4 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">Signup cohorts</h3>
          <div className="mt-2">
            <DataTable head={["Signed up in", "Schools", "Paid ever", "Paying now"]}>
              {[...coh].reverse().filter((c) => c.signedUp).slice(0, 8).map((c) => (
                <Tr key={c.month}>
                  <Td className="text-muted-foreground">{monthLabel(c.month)}</Td>
                  <Td data-nums="">{c.signedUp}</Td>
                  <Td data-nums="">{c.paidEver} · {pct(c.paidEver, c.signedUp)}</Td>
                  <Td data-nums="">{c.payingNow} · {pct(c.payingNow, c.signedUp)}</Td>
                </Tr>
              ))}
            </DataTable>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Renewals</h2>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Stat label="Due in 30 days" value={ren.dueSoon.length} hint={ghs(ren.dueSoon.reduce((a, r) => a + (r.sub?.amountPesewas ?? 0), 0))} />
            <Stat label="Past due" value={ren.pastDue.length} tone={ren.pastDue.length ? "danger" : "default"} />
            <Stat label="Lapsed" value={ren.lapsed.length} tone={ren.lapsed.length ? "warning" : "default"} />
          </div>
          <div className="mt-3">
            <DataTable head={["School", "State", "Period ends", "Amount"]}>
              {[...ren.pastDue, ...ren.dueSoon].slice(0, 12).map((r) => (
                <Tr key={r.school.id}>
                  <Td><Link href={`/platform/financials/schools/${r.school.id}`} className="font-medium text-primary hover:underline">{r.school.name}</Link></Td>
                  <Td><Badge tone={r.school.status === "past_due" ? "danger" : "warning"}>{r.school.status === "past_due" ? `${Math.abs(r.daysToEnd ?? 0)} days late` : `in ${r.daysToEnd} days`}</Badge></Td>
                  <Td className="text-muted-foreground" data-nums="">{r.sub ? ym(r.sub.periodEnd) : "—"}</Td>
                  <Td data-nums="">{r.sub ? ghs(r.sub.amountPesewas) : "—"}</Td>
                </Tr>
              ))}
            </DataTable>
            {ren.pastDue.length + ren.dueSoon.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Nothing due in the next 30 days.</p>}
          </div>
        </Card>
        <Card>
          <h2 className="font-semibold">Messaging economics</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">Charged to schools against provider cost, by month.</p>
          <div className="mt-3"><Columns color={PILLAR.learning} bins={eco.map((m) => ({ label: monthLabel(m.month).slice(0, 3), n: m.messages }))} /></div>
          <div className="mt-3">
            <DataTable head={["Month", "Messages", "Charged", "Cost", "Margin"]}>
              {[...eco].reverse().slice(0, 6).map((m) => (
                <Tr key={m.month}>
                  <Td className="text-muted-foreground">{monthLabel(m.month)}</Td>
                  <Td data-nums="">{m.messages.toLocaleString()}</Td>
                  <Td data-nums="">{ghs(m.charged)}</Td>
                  <Td data-nums="">{ghs(m.cost)}</Td>
                  <Td className={m.margin >= 0 ? "text-success" : "text-danger"} data-nums="">{ghs(m.margin)}</Td>
                </Tr>
              ))}
            </DataTable>
          </div>
        </Card>
      </div>
    </div>
  );
}
