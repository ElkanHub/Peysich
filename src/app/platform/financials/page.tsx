import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions, schools, plans, feePayments, smsLog } from "@/db/schema";
import { Card, DataTable, PageHeader, Stat, Tr, Td } from "@/ui/kit";

const ghs = (p: number) => `GHS ${(p / 100).toLocaleString()}`;

/** Financials: subscription revenue, per-plan mix, monthly trend, platform GMV. */
export default async function Financials() {
  const [subs, allPlans, allSchools, [gmv], [smsCost]] = await Promise.all([
    db.select({
      amount: subscriptions.amountPesewas, planKey: subscriptions.planKey,
      createdAt: subscriptions.createdAt, name: schools.name,
    }).from(subscriptions)
      .innerJoin(schools, eq(subscriptions.schoolId, schools.id))
      .orderBy(desc(subscriptions.createdAt)),
    db.select().from(plans),
    db.select().from(schools),
    db.select({ n: sql<number>`coalesce(sum(amount_pesewas),0)` }).from(feePayments),
    db.select({ n: sql<number>`coalesce(sum(cost_pesewas),0)` }).from(smsLog),
  ]);
  const price = new Map(allPlans.map((p) => [p.key, p.pricePerMonthPesewas]));
  const active = allSchools.filter((s) => s.status === "active");
  const mrr = active.reduce((a, s) => a + (price.get(s.planKey) ?? 0), 0);
  const collected = subs.reduce((a, s) => a + s.amount, 0);

  const byPlan = new Map<string, { n: number; amount: number }>();
  for (const s of subs) {
    const e = byPlan.get(s.planKey) ?? { n: 0, amount: 0 };
    e.n++; e.amount += s.amount; byPlan.set(s.planKey, e);
  }
  const byMonth = new Map<string, number>();
  for (const s of subs) {
    const m = s.createdAt.toISOString().slice(0, 7);
    byMonth.set(m, (byMonth.get(m) ?? 0) + s.amount);
  }
  const months = [...byMonth.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 12);
  const maxMonth = Math.max(1, ...months.map(([, v]) => v));

  return (
    <div className="space-y-6">
      <PageHeader title="Financials" sub="Subscription revenue and platform money flow" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="MRR" value={ghs(mrr)} tone="success" />
        <Stat label="Collected all-time" value={ghs(collected)} />
        <Stat label="School fees processed" value={ghs(Number(gmv.n))} />
        <Stat label="SMS cost (re-billable)" value={ghs(Number(smsCost.n))} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Revenue by month</h2>
          <div className="mt-4 space-y-2.5">
            {months.map(([m, v]) => (
              <div key={m} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-[13px] text-muted-foreground" data-nums="">{m}</span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-primary/80" style={{ width: `${(v / maxMonth) * 100}%` }} />
                </span>
                <span className="w-24 shrink-0 text-right text-[13px]" data-nums="">{ghs(v)}</span>
              </div>
            ))}
            {months.length === 0 && <p className="text-sm text-muted-foreground">No payments yet.</p>}
          </div>
        </Card>
        <Card>
          <h2 className="font-semibold">Mix by plan</h2>
          <div className="mt-3">
            <DataTable head={["Plan", "Payments", "Collected"]}>
              {[...byPlan.entries()].sort((a, b) => b[1].amount - a[1].amount).map(([k, v]) => (
                <Tr key={k}>
                  <Td className="font-medium capitalize">{k}</Td>
                  <Td data-nums="">{v.n}</Td>
                  <Td data-nums="">{ghs(v.amount)}</Td>
                </Tr>
              ))}
            </DataTable>
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold">Latest payments</h2>
        <div className="mt-3">
          <DataTable head={["Date", "School", "Plan", "Amount"]}>
            {subs.slice(0, 12).map((s, i) => (
              <Tr key={i}>
                <Td className="text-muted-foreground">{s.createdAt.toISOString().slice(0, 10)}</Td>
                <Td className="font-medium">{s.name}</Td>
                <Td className="capitalize">{s.planKey}</Td>
                <Td data-nums="">{ghs(s.amount)}</Td>
              </Tr>
            ))}
          </DataTable>
        </div>
      </Card>
    </div>
  );
}
