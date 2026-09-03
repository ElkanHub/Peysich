import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { plans, schools } from "@/db/schema";
import { ALL_MODULES, MODULE_LABELS } from "@/core/plan-const";
import { Badge, Card, PageHeader, inputCls } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";
import { btnCls } from "@/ui/kit";
import { savePlan } from "../plan-admin-actions";

/* ── Plans configurator ─────────────────────────────────────────────────────
   The one place plans are edited. Saving republishes everywhere at once:
   every school's Billing page AND the static marketing pricing (the cache
   tag regenerates it — no redeploy, no dynamic rendering).               */

export default async function PlatformPlans() {
  const allPlans = await db.select().from(plans).orderBy(asc(plans.pricePerMonthPesewas));
  const customSchoolIds = allPlans.map((p) => p.schoolId).filter((x): x is string => !!x);
  const schoolNames = new Map<string, string>();
  for (const sid of customSchoolIds) {
    const [s] = await db.select({ name: schools.name }).from(schools).where(eq(schools.id, sid));
    if (s) schoolNames.set(sid, s.name);
  }
  const stock = allPlans.filter((p) => !p.schoolId);
  const custom = allPlans.filter((p) => p.schoolId);

  return (
    <div className="max-w-4xl">
      <PageHeader title="Plans"
        sub="Edit prices, caps and modules. Saving publishes to every school's Billing page and the public marketing pricing — instantly, no redeploy." />
      <div className="grid gap-4">
        {stock.map((p) => <PlanForm key={p.key} plan={p} />)}
      </div>
      <h2 className="mt-10 font-semibold">Custom plans</h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">
        Private to one school each — never shown on the marketing page. They&apos;re created by
        approving a request in the Requests inbox.
      </p>
      {custom.length === 0
        ? <p className="text-sm text-muted-foreground">None yet.</p>
        : <div className="grid gap-4">
            {custom.map((p) => <PlanForm key={p.key} plan={p} schoolName={schoolNames.get(p.schoolId!)} />)}
          </div>}
    </div>
  );
}

function PlanForm({ plan: p, schoolName }: {
  plan: typeof plans.$inferSelect; schoolName?: string;
}) {
  return (
    <Card>
      <form action={savePlan.bind(null, p.key)}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{p.key}</span>
          {schoolName && <Badge>{schoolName} only</Badge>}
          {!p.active && <Badge tone="danger">Inactive</Badge>}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <label className="grid gap-1 text-sm sm:col-span-1">
            <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Name</span>
            <input name="name" defaultValue={p.name} className={inputCls} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">GHS / month</span>
            <input name="monthly" type="number" step="0.01" min="0"
              defaultValue={(p.pricePerMonthPesewas / 100).toString()} className={inputCls} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">GHS / year</span>
            <input name="yearly" type="number" step="0.01" min="0"
              defaultValue={(p.pricePerYearPesewas / 100).toString()} className={inputCls} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Student cap</span>
            <input name="cap" type="number" min="1" placeholder="Unlimited"
              defaultValue={p.studentCap ?? ""} className={inputCls} />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          {ALL_MODULES.map((k) => (
            <label key={k} className="flex items-center gap-1.5 text-[13.5px]">
              <input type="checkbox" name={`m_${k}`} defaultChecked={p.moduleKeys.includes(k)} className="accent-primary" />
              {MODULE_LABELS[k]}
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-1.5 text-[13.5px]">
            <input type="checkbox" name="isPublic" defaultChecked={p.isPublic} className="accent-primary" />
            Show on marketing page
          </label>
          <SubmitButton className={btnCls} pendingText="Publishing…">Save & publish</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
