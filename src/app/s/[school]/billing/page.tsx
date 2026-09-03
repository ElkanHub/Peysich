import { and, desc, eq, or, sql } from "drizzle-orm";
import { Check, Minus } from "lucide-react";
import Link from "next/link";
import { db } from "@/db";
import { plans, students, subscriptions } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { submitCustomRequest } from "@/app/plan-request-actions";
import {
  ADDON_MODULES, ADDON_PRICES, ALL_MODULES, BASE_PESEWAS, CORE_MODULES,
  MODULE_LABELS, SIZE_BANDS,
} from "@/core/plan-const";
import { PlanBuilder } from "@/modules/plans/builder";
import { Badge, Card, PageHeader } from "@/ui/kit";
import { cn } from "@/lib/utils";
import { CancelPlan } from "./cancel";
import { UpgradeButton } from "./upgrade";

/* ── Billing & plan ─────────────────────────────────────────────────────────
   Nothing hidden: every plan lists what it includes AND what it leaves out,
   the comparison table shows all of it at once, and the custom builder and
   the cancel door are on the same page — findable, honest, no dark patterns. */

export default async function Billing({ params, searchParams }: {
  params: Promise<{ school: string }>;
  searchParams: Promise<{ cycle?: string }>;
}) {
  const { school: slug } = await params;
  const { cycle: cycleRaw } = await searchParams;
  const cycle: "monthly" | "yearly" = cycleRaw === "yearly" ? "yearly" : "monthly";
  const { school, user } = await requireSchool(slug, ["admin"]);

  const [visiblePlans, [latestSub], [{ n: activeStudents }]] = await Promise.all([
    db.select().from(plans)
      .where(and(eq(plans.active, true), or(eq(plans.isPublic, true), eq(plans.schoolId, school.id))))
      .orderBy(plans.pricePerMonthPesewas),
    db.select().from(subscriptions).where(eq(subscriptions.schoolId, school.id))
      .orderBy(desc(subscriptions.createdAt)).limit(1),
    db.select({ n: sql<number>`count(*)` }).from(students)
      .where(and(eq(students.schoolId, school.id), eq(students.status, "active"))),
  ]);

  const current = visiblePlans.find((p) => p.key === school.planKey);
  const email = (user as { email?: string }).email ?? "admin@school";
  const cancelPending = (school.settings as { cancelRequested?: { at: string; reason: string } }).cancelRequested;
  const ghs = (p: number) => `GHS ${(p / 100).toLocaleString()}`;
  const price = (p: typeof visiblePlans[number]) =>
    cycle === "yearly" ? p.pricePerYearPesewas : p.pricePerMonthPesewas;
  const usedPct = current?.studentCap
    ? Math.min(100, Math.round((Number(activeStudents) / current.studentCap) * 100)) : null;

  // Cards: paid public plans plus this school's own private plan, if any.
  const cardPlans = visiblePlans.filter((p) => p.key !== "trial");

  return (
    <div className="max-w-5xl">
      <PageHeader title="Billing & plan" sub="What you're on, what everything costs, and the door out — all on one page." />

      {/* Current plan */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Your plan</p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xl font-semibold">
              {current?.name ?? school.planKey}
              {school.status === "trial" && <Badge tone="warning">Trial</Badge>}
              {cancelPending && <Badge tone="warning">Cancellation requested</Badge>}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {latestSub
                ? <>Renews {latestSub.periodEnd.toISOString().slice(0, 10)} · {latestSub.cycle} · {ghs(latestSub.amountPesewas)}</>
                : school.trialEndsAt && school.status === "trial"
                  ? <>Trial ends {school.trialEndsAt.toISOString().slice(0, 10)} — pick a plan below before then.</>
                  : <>No payment on file yet.</>}
            </p>
            {cancelPending && (
              <p className="mt-1 text-sm text-warning">
                We received your cancellation request on {cancelPending.at.slice(0, 10)} and will call before
                anything changes. Changed your mind? Just tell us on that call.
              </p>
            )}
          </div>
          {current?.studentCap != null && (
            <div className="w-full sm:w-64">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">{Number(activeStudents).toLocaleString()} students</span>
                <span className="text-muted-foreground">of {current.studentCap.toLocaleString()}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full", (usedPct ?? 0) >= 90 ? "bg-warning" : "bg-primary")}
                  style={{ width: `${usedPct}%` }} />
              </div>
              {(usedPct ?? 0) >= 90 && (
                <p className="mt-1 text-xs text-warning">You&apos;re close to your cap — the next plan up removes it.</p>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Cycle toggle */}
      <div className="mb-4 flex items-center gap-3">
        <div className="inline-flex rounded-full bg-muted p-1">
          {(["monthly", "yearly"] as const).map((c) => (
            <Link key={c} href={`?cycle=${c}`} scroll={false}
              className={cn("rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors",
                cycle === c ? "bg-brand-container text-on-brand-container" : "text-muted-foreground hover:text-foreground")}>
              {c}
            </Link>
          ))}
        </div>
        {cycle === "yearly" && <span className="text-sm font-medium text-success">2 months free on every plan</span>}
      </div>

      {/* Plan cards — with what's IN and what's OUT */}
      <div className="grid gap-4 md:grid-cols-3">
        {cardPlans.map((p) => {
          const isCurrent = school.planKey === p.key;
          const included = ALL_MODULES.filter((k) => p.moduleKeys.includes(k));
          const excluded = ALL_MODULES.filter((k) => !p.moduleKeys.includes(k));
          return (
            <Card key={p.key} className={cn(isCurrent && "ring-2 ring-primary")}>
              <div className="flex items-center justify-between">
                <p className="font-semibold">{p.name}</p>
                {isCurrent && <Badge tone="success">Current</Badge>}
                {p.schoolId === school.id && <Badge>Yours only</Badge>}
              </div>
              <p className="mt-2 text-3xl font-semibold tracking-tight">
                {ghs(price(p))}
                <span className="text-sm font-normal text-muted-foreground">/{cycle === "yearly" ? "year" : "month"}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {p.studentCap ? `Up to ${p.studentCap.toLocaleString()} students` : "Unlimited students"}
              </p>
              <ul className="mt-3 grid gap-1.5 text-[13.5px]">
                {included.map((k) => (
                  <li key={k} className="flex items-center gap-2">
                    <Check size={14} className="shrink-0 text-success" /> {MODULE_LABELS[k]}
                  </li>
                ))}
                {excluded.map((k) => (
                  <li key={k} className="flex items-center gap-2 text-muted-foreground/60">
                    <Minus size={14} className="shrink-0" /> {MODULE_LABELS[k]}
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                {isCurrent
                  ? <span className="text-sm font-medium text-success">This is your plan</span>
                  : <UpgradeButton schoolId={school.id} planKey={p.key} email={email} cycle={cycle} />}
              </div>
            </Card>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Moving down a plan? That works too — modules outside the smaller plan close, but nothing is deleted:
        the data is waiting if you ever come back up.
      </p>

      {/* Comparison table */}
      <h2 className="mt-10 font-semibold">Everything, side by side</h2>
      <div className="mt-3 overflow-x-auto rounded-2xl bg-card shadow-md">
        <table className="w-full min-w-[560px] text-[13.5px]">
          <thead>
            <tr className="text-left font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Module</th>
              {cardPlans.map((p) => (
                <th key={p.key} className={cn("px-4 py-3 text-center", school.planKey === p.key && "text-primary")}>{p.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALL_MODULES.map((k) => (
              <tr key={k} className="border-t border-border/50">
                <td className="px-4 py-2.5">{MODULE_LABELS[k]}</td>
                {cardPlans.map((p) => (
                  <td key={p.key} className="px-4 py-2.5 text-center">
                    {p.moduleKeys.includes(k)
                      ? <Check size={15} className="mx-auto text-success" />
                      : <Minus size={15} className="mx-auto text-muted-foreground/40" />}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t border-border/50 font-medium">
              <td className="px-4 py-2.5">Student cap</td>
              {cardPlans.map((p) => (
                <td key={p.key} className="px-4 py-2.5 text-center">
                  {p.studentCap ? p.studentCap.toLocaleString() : "None"}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Custom builder */}
      <h2 className="mt-10 font-semibold">None of these fit? Build your own.</h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">
        Tick exactly what your school needs. We&apos;ll call you, talk it through, and set the plan up for you.
      </p>
      <Card>
        <PlanBuilder mode="app"
          coreLabels={CORE_MODULES.map((k) => MODULE_LABELS[k])}
          addons={ADDON_MODULES.map((k) => ({ key: k, label: MODULE_LABELS[k], pricePesewas: ADDON_PRICES[k] }))}
          bands={SIZE_BANDS} basePesewas={BASE_PESEWAS}
          defaultPhone={school.branding.phone ?? ""}
          action={submitCustomRequest.bind(null, slug)} />
      </Card>

      {/* Cancel — findable, honest, but asks why */}
      <div className="mt-10 border-t border-border pt-6">
        {cancelPending
          ? <p className="text-sm text-muted-foreground">
              Cancellation requested — we&apos;ll call you before anything changes.
            </p>
          : <CancelPlan slug={slug} />}
      </div>
    </div>
  );
}
