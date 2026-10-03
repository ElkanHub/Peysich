import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { outbox, schools } from "@/db/schema";
import { arkeselBalance } from "@/messaging/providers/arkesel";
import { getSettings } from "@/messaging/settings";
import { getPrices, ghs, type Channel } from "@/messaging/wallet";
import { Card, DataTable, PageHeader, Stat, Tr, Td } from "@/ui/kit";

export const dynamic = "force-dynamic";

/** Messaging costs: this month by school and channel — what the schools were
 *  charged, what the providers cost us, the margin — and the providers' health. */
export default async function MessagingCosts() {
  const monthStart = new Date(new Date().toISOString().slice(0, 7) + "-01");
  const [rows, prices, settings, smsLeft] = await Promise.all([
    db.select({
      school: schools.name, channel: outbox.channel, status: outbox.status,
      n: sql<number>`count(*)`, parts: sql<number>`coalesce(sum(${outbox.parts}), 0)`,
      charged: sql<number>`coalesce(sum(${outbox.pricePesewas}), 0)`,
    }).from(outbox).leftJoin(schools, eq(outbox.schoolId, schools.id))
      .where(and(gte(outbox.createdAt, monthStart)))
      .groupBy(schools.name, outbox.channel, outbox.status),
    getPrices(), getSettings(), arkeselBalance(),
  ]);

  // ponytail: cost uses today's cost per channel, not the cost on the day of each send
  type Line = { school: string; channel: string; n: number; charged: number; cost: number };
  const lines = new Map<string, Line>();
  let failed = 0, emails = 0;
  for (const r of rows) {
    if (r.status === "failed") { failed += Number(r.n); continue; }
    if (r.status === "held") continue;
    if (r.channel === "email") emails += Number(r.n);
    const k = `${r.school}|${r.channel}`;
    const e = lines.get(k) ?? { school: r.school ?? "SchoolSpec", channel: r.channel, n: 0, charged: 0, cost: 0 };
    const units = r.channel === "sms" ? Number(r.parts) : Number(r.n);
    e.n += units; e.charged += Number(r.charged);
    e.cost += units * (prices[r.channel as Channel]?.costPesewas ?? 0);
    lines.set(k, e);
  }
  const list = [...lines.values()].sort((a, b) => b.charged - a.charged);
  const charged = list.reduce((a, l) => a + l.charged, 0), cost = list.reduce((a, l) => a + l.cost, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Messaging costs" sub="This month: what schools were charged, what it cost, and the margin" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Charged to schools" value={ghs(charged)} />
        <Stat label="Provider cost" value={ghs(cost)} />
        <Stat label="Margin" value={ghs(charged - cost)} tone="success" />
        <Stat label="Failed sends" value={failed} tone={failed ? "danger" : "default"} />
      </div>
      <Card>
        <h2 className="font-semibold">Providers</h2>
        <ul className="mt-2 space-y-1 text-sm">
          <li>Arkesel SMS left: <b data-nums="">{smsLeft ?? "not connected"}</b></li>
          <li>Resend emails this month: <b data-nums="">{emails}</b> of 3,000 on the free plan</li>
          <li>Meta quality rating: <b>{settings.wa_quality || "not read yet"}</b> · {settings.wa_daily_cap} WhatsApp recipients a day</li>
        </ul>
      </Card>
      <Card>
        <h2 className="font-semibold">By school and channel</h2>
        <div className="mt-3">
          <DataTable head={["School", "Channel", "Messages", "Charged", "Cost", "Margin"]}>
            {list.map((l) => (
              <Tr key={`${l.school}|${l.channel}`}>
                <Td className="font-medium">{l.school}</Td>
                <Td>{l.channel}</Td>
                <Td data-nums="">{l.n.toLocaleString()}</Td>
                <Td data-nums="">{ghs(l.charged)}</Td>
                <Td data-nums="">{ghs(l.cost)}</Td>
                <Td data-nums="">{ghs(l.charged - l.cost)}</Td>
              </Tr>
            ))}
          </DataTable>
          {list.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Nothing sent this month yet.</p>}
        </div>
      </Card>
    </div>
  );
}
