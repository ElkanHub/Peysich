import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { plans, schoolModules, schools, subscriptions } from "@/db/schema";
import { MODULE_CATALOG } from "@/modules/catalog";
import { getEnabledModules } from "@/core/entitlements";
import { setModuleMode, setSchoolStatus, setCustomPlan, extendTrial, setSchoolPlan } from "../../actions";
import { getOnboardingStages, getSchoolUsers } from "@/core/onboarding";
import { Badge } from "@/ui/kit";
import { cn } from "@/lib/utils";

export default async function SchoolDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [school] = await db.select().from(schools).where(eq(schools.id, id));
  if (!school) notFound();
  const [plan] = await db.select().from(plans).where(eq(plans.key, school.planKey));
  const overrides = new Map(
    (await db.select().from(schoolModules).where(eq(schoolModules.schoolId, id)))
      .map((o) => [o.moduleKey, o.mode]),
  );
  const effective = await getEnabledModules(id);
  const [stages, people, subs] = await Promise.all([
    getOnboardingStages(id), getSchoolUsers(id),
    db.select().from(subscriptions).where(eq(subscriptions.schoolId, id)),
  ]);

  const MODES = ["default", "on", "off"] as const;
  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{school.name}</h1>
          <p className="text-sm text-muted-foreground">
            {school.slug} · plan: {plan?.name ?? school.planKey} · status: {school.status}
          </p>
        </div>
        <div className="flex items-center gap-2">
        <form action={setSchoolPlan.bind(null, id)} className="flex items-center gap-1">
          <select name="planKey" defaultValue={school.planKey}
            className="rounded-md border border-border bg-card px-2 py-1.5 text-sm">
            {["trial", "starter", "standard", "premium", `custom-${school.slug}`].map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
          <button className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">Set plan</button>
        </form>
        <form action={setSchoolStatus.bind(null, id, school.status === "suspended" ? "active" : "suspended")}>
          <button className={cn("rounded-md px-3 py-1.5 text-sm font-medium text-white",
            school.status === "suspended" ? "bg-success" : "bg-danger")}>
            {school.status === "suspended" ? "Reactivate" : "Suspend"}
          </button>
        </form>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="font-semibold">Onboarding progress</h2>
          <ul className="mt-2 space-y-1.5 text-sm">
            {stages.map((st) => (
              <li key={st.key} className="flex items-center justify-between">
                <span>{st.label}</span>
                {st.done ? <Badge tone="success">done</Badge> : <Badge tone="danger">pending</Badge>}
              </li>
            ))}
          </ul>
          {school.status === "trial" && (
            <form action={extendTrial.bind(null, id, 14)} className="mt-3">
              <button className="rounded-md border border-border px-3 py-1.5 text-[13px] font-medium hover:bg-muted">
                Extend trial 14 days{school.trialEndsAt && ` (ends ${school.trialEndsAt.toISOString().slice(0, 10)})`}
              </button>
            </form>
          )}
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="font-semibold">People & contacts</h2>
          <ul className="mt-2 space-y-1.5 text-sm">
            {people.slice(0, 8).map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0"><span className="font-medium">{u.name}</span>
                  <span className="block truncate text-[13px] text-muted-foreground">{u.email}{u.phone && ` · ${u.phone}`}</span></span>
                <Badge tone={u.role === "admin" ? "success" : "default"}>{u.role}</Badge>
              </li>
            ))}
            {people.length === 0 && <li className="text-muted-foreground">No accounts yet.</li>}
          </ul>
          {subs.length > 0 && (
            <div className="mt-3 border-t border-border pt-2 text-[13px] text-muted-foreground">
              {subs.length} payment{subs.length > 1 ? "s" : ""} · latest {subs.at(-1)!.planKey} until {subs.at(-1)!.periodEnd.toISOString().slice(0, 10)}
            </div>
          )}
        </div>
      </div>

      <h2 className="mt-8 text-lg font-semibold">Module switchboard</h2>
      <p className="text-sm text-muted-foreground">
        Plan default · Force ON · Force OFF — every flip is audited. Data is never deleted.
      </p>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="py-2">Module</th><th>In plan</th><th>Effective</th><th className="text-right">Override</th>
          </tr>
        </thead>
        <tbody>
          {MODULE_CATALOG.map((m) => {
            const current = overrides.get(m.key) ?? "default";
            return (
              <tr key={m.key} className="border-b border-border">
                <td className="py-2 font-medium">{m.name}</td>
                <td>{plan?.moduleKeys.includes(m.key) ? "✓" : "—"}</td>
                <td>{effective.has(m.key)
                  ? <span className="text-success">on</span>
                  : <span className="text-muted-foreground">off</span>}</td>
                <td className="py-1 text-right">
                  {MODES.map((mode) => (
                    <form key={mode} action={setModuleMode.bind(null, id, m.key, mode)} className="inline">
                      <button className={cn(
                        "ml-1 rounded-md border px-2 py-1 text-xs",
                        current === mode
                          ? "border-primary/40 bg-brand-container text-on-brand-container"
                          : "border-border text-muted-foreground hover:bg-muted")}>
                        {mode}
                      </button>
                    </form>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h2 className="mt-8 text-lg font-semibold">Custom plan</h2>
      <p className="text-sm text-muted-foreground">Compose exactly the modules this school pays for, at your price. Overrides above still apply on top.</p>
      <form action={setCustomPlan.bind(null, id)} className="mt-3 rounded-lg border border-border bg-card p-4">
        <div className="grid grid-cols-3 gap-2 text-sm">
          {MODULE_CATALOG.map((m) => (
            <label key={m.key} className="flex items-center gap-2">
              <input type="checkbox" name={`m_${m.key}`} defaultChecked={plan?.moduleKeys.includes(m.key)} /> {m.name}
            </label>
          ))}
        </div>
        <div className="mt-3 flex items-end gap-3 text-sm">
          <label>Price GHS/month<br />
            <input name="priceGhs" type="number" step="0.01" defaultValue={(plan?.pricePerMonthPesewas ?? 0) / 100}
              className="mt-1 w-32 rounded-md border border-border px-2 py-1" /></label>
          <label>Student cap (blank = unlimited)<br />
            <input name="studentCap" type="number" defaultValue={plan?.studentCap ?? ""}
              className="mt-1 w-32 rounded-md border border-border px-2 py-1" /></label>
          <button className={cn("rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground")}>
            Apply custom plan
          </button>
        </div>
      </form>
    </div>
  );
}
