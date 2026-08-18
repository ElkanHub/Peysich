import Link from "next/link";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { schools, plans, subscriptions, leads, students, feePayments } from "@/db/schema";
import { Card, PageHeader, Stat, Badge, DataTable, Tr, Td } from "@/ui/kit";

const ghs = (p: number) => `GHS ${(p / 100).toLocaleString()}`;

/** Overview: the business at a glance — money, funnel, movement. */
export default async function Overview() {
  const [allSchools, allPlans, subs, newLeads, [stu], [gmv]] = await Promise.all([
    db.select().from(schools).orderBy(desc(schools.createdAt)),
    db.select().from(plans),
    db.select().from(subscriptions).orderBy(desc(subscriptions.createdAt)),
    db.select().from(leads).where(eq(leads.status, "new")),
    db.select({ n: sql<number>`count(*)` }).from(students).where(eq(students.status, "active")),
    db.select({ n: sql<number>`coalesce(sum(amount_pesewas),0)` }).from(feePayments),
  ]);
  const price = new Map(allPlans.map((p) => [p.key, p.pricePerTermPesewas]));
  const active = allSchools.filter((s) => s.status === "active");
  const trials = allSchools.filter((s) => s.status === "trial");
  const attention = allSchools.filter((s) => ["past_due", "suspended", "expired"].includes(s.status));
  const termRevenue = active.reduce((a, s) => a + (price.get(s.planKey) ?? 0), 0);
  const collected = subs.reduce((a, s) => a + s.amountPesewas, 0);
  const recentSchools = allSchools.slice(0, 6);
  const tone = (st: string) =>
    st === "active" ? "success" : st === "trial" ? "brand" : "danger";

  return (
    <div>
      <PageHeader title="Overview" sub="The business at a glance" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Active schools" value={active.length} />
        <Stat label="Revenue / term" value={ghs(termRevenue)} tone="success" />
        <Stat label="Trials running" value={trials.length} />
        <Stat label="New leads" value={newLeads.length} tone={newLeads.length ? "danger" : "default"} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Students on platform" value={String(stu.n)} />
        <Stat label="Subscription collected" value={ghs(collected)} />
        <Stat label="School fees processed" value={ghs(Number(gmv.n))} />
        <Stat label="Needs attention" value={attention.length}
          tone={attention.length ? "danger" : "success"} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Recent signups</h2>
            <Link href="/platform/schools" className="text-[13px] font-medium text-primary">All schools →</Link>
          </div>
          <div className="mt-3">
            <DataTable head={["School", "Plan", "Status", "Joined"]}>
              {recentSchools.map((s) => (
                <Tr key={s.id}>
                  <Td><Link href={`/platform/schools/${s.id}`} className="font-medium text-primary">{s.name}</Link></Td>
                  <Td className="capitalize">{s.planKey}</Td>
                  <Td><Badge tone={tone(s.status)}>{s.status.replace("_", " ")}</Badge></Td>
                  <Td className="text-muted-foreground">{s.createdAt.toISOString().slice(0, 10)}</Td>
                </Tr>
              ))}
            </DataTable>
          </div>
        </Card>
        <div className="space-y-4">
          <Card>
            <h2 className="font-semibold">Trials ending soon</h2>
            <ul className="mt-2.5 space-y-2 text-[13px]">
              {trials
                .sort((a, b) => +(a.trialEndsAt ?? 0) - +(b.trialEndsAt ?? 0))
                .slice(0, 5)
                .map((s) => {
                  const days = s.trialEndsAt
                    ? Math.max(0, Math.ceil((+s.trialEndsAt - Date.now()) / 86400000)) : null;
                  return (
                    <li key={s.id} className="flex justify-between">
                      <Link href={`/platform/schools/${s.id}`} className="font-medium hover:text-primary">{s.name}</Link>
                      <span className={days !== null && days <= 3 ? "text-danger" : "text-muted-foreground"}>
                        {days !== null ? `${days}d left` : "—"}
                      </span>
                    </li>
                  );
                })}
              {trials.length === 0 && <li className="text-muted-foreground">No trials running.</li>}
            </ul>
            <Link href="/platform/subscriptions" className="mt-3 inline-block text-[13px] font-medium text-primary">
              Manage subscriptions →
            </Link>
          </Card>
          <Card>
            <h2 className="font-semibold">Needs attention</h2>
            <ul className="mt-2.5 space-y-2 text-[13px]">
              {attention.slice(0, 5).map((s) => (
                <li key={s.id} className="flex justify-between">
                  <Link href={`/platform/schools/${s.id}`} className="font-medium hover:text-primary">{s.name}</Link>
                  <Badge tone="danger">{s.status.replace("_", " ")}</Badge>
                </li>
              ))}
              {attention.length === 0 && <li className="text-muted-foreground">All clear ✓</li>}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
