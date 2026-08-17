import { eq } from "drizzle-orm";
import { db } from "@/db";
import { plans, subscriptions } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { MODULE_CATALOG } from "@/modules/catalog";
import { Card, DataTable, PageHeader, Tr, Td } from "@/ui/kit";
import { UpgradeButton } from "./upgrade";

/** Billing: current plan, what upgrading unlocks (upsell lives HERE, not in
 *  greyed nav — doc 03), payment history. */
export default async function Billing({ params }: { params: Promise<{ school: string }> }) {
  const { school: slug } = await params;
  const { school, user, modules } = await requireSchool(slug, ["admin"]);
  const [allPlans, subs] = await Promise.all([
    db.select().from(plans).where(eq(plans.active, true)),
    db.select().from(subscriptions).where(eq(subscriptions.schoolId, school.id)),
  ]);
  const order = ["starter", "standard", "premium"];
  const email = (user as { email?: string }).email ?? "admin@school";

  return (
    <div className="max-w-3xl">
      <PageHeader title="Billing & Plan"
        sub={`Current: ${school.planKey} · status: ${school.status}${school.trialEndsAt && school.status === "trial" ? ` (ends ${school.trialEndsAt.toISOString().slice(0, 10)})` : ""}`} />
      <div className="grid gap-4 md:grid-cols-3">
        {order.map((key) => {
          const p = allPlans.find((x) => x.key === key);
          if (!p) return null;
          const unlocks = p.moduleKeys.filter((k) => !modules.has(k))
            .map((k) => MODULE_CATALOG.find((m) => m.key === k)?.name ?? k);
          const isCurrent = school.planKey === key;
          return (
            <Card key={key} className={isCurrent ? "border-primary" : ""}>
              <p className="font-semibold">{p.name}</p>
              <p className="mt-1 text-2xl font-semibold">GHS {(p.pricePerTermPesewas / 100).toLocaleString()}<span className="text-sm font-normal text-muted-foreground">/term</span></p>
              <p className="mt-1 text-xs text-muted-foreground">
                {p.studentCap ? `Up to ${p.studentCap} students` : "Unlimited students"}
              </p>
              {unlocks.length > 0 && !isCurrent && (
                <p className="mt-2 text-xs text-muted-foreground">Adds: {unlocks.join(", ")}</p>
              )}
              <div className="mt-3">
                {isCurrent
                  ? <span className="text-sm font-medium text-success">Current plan</span>
                  : <UpgradeButton schoolId={school.id} planKey={key} email={email} />}
              </div>
            </Card>
          );
        })}
      </div>
      <h2 className="mt-8 font-semibold">Payment history</h2>
      <div className="mt-2">
        <DataTable head={["Date", "Plan", "Period", "Status", "Reference"]}>
          {subs.map((s) => (
            <Tr key={s.id}>
              <Td>{s.createdAt.toISOString().slice(0, 10)}</Td>
              <Td className="capitalize">{s.planKey}</Td>
              <Td>{s.periodStart.toISOString().slice(0, 10)} → {s.periodEnd.toISOString().slice(0, 10)}</Td>
              <Td className="capitalize">{s.status}</Td>
              <Td className="font-mono text-xs">{s.paystackSubscriptionCode}</Td>
            </Tr>
          ))}
        </DataTable>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Need a custom plan? Contact us — we&apos;ll compose exactly the modules you want.
      </p>
    </div>
  );
}
