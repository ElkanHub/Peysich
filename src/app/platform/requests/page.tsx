import { desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { planRequests, schools } from "@/db/schema";
import { MODULE_LABELS, SIZE_BANDS, ghsPlan } from "@/core/plan-const";
import { Badge, Card, Empty, PageHeader, inputCls, btnCls } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";
import { approveCustomRequest, setRequestStatus } from "../plan-admin-actions";
import { Inbox } from "lucide-react";

/* ── Plan requests inbox ────────────────────────────────────────────────────
   Two streams land here: custom-plan asks (from schools' Billing pages and
   the public marketing builder) and cancellation feedback. The pipeline is
   call-first: contact → negotiate → approve as a private plan.           */

const TONE = {
  new: "danger", contacted: "warning", negotiating: "warning",
  approved: "success", declined: "default", closed: "default",
} as const;

const NEXT: Record<string, string[]> = {
  new: ["contacted", "declined"],
  contacted: ["negotiating", "declined", "closed"],
  negotiating: ["declined", "closed"],
  approved: ["closed"], declined: ["closed"], closed: [],
};

export default async function PlatformRequests() {
  const rows = await db.select().from(planRequests).orderBy(desc(planRequests.createdAt)).limit(200);
  const schoolIds = [...new Set(rows.map((r) => r.schoolId).filter((x): x is string => !!x))];
  const schoolRows = schoolIds.length
    ? await db.select({ id: schools.id, name: schools.name, planKey: schools.planKey })
        .from(schools).where(inArray(schools.id, schoolIds))
    : [];
  const schoolOf = new Map(schoolRows.map((s) => [s.id, s]));
  const customs = rows.filter((r) => r.kind === "custom");
  const cancels = rows.filter((r) => r.kind === "cancel");
  const open = customs.filter((r) => ["new", "contacted", "negotiating"].includes(r.status)).length;

  return (
    <div className="max-w-4xl">
      <PageHeader title="Plan requests"
        sub={`${open} open custom ask${open === 1 ? "" : "s"} · ${cancels.filter((c) => c.status === "new").length} new cancellation${cancels.filter((c) => c.status === "new").length === 1 ? "" : "s"} — call first, always.`} />

      <h2 className="font-semibold">Custom plan asks</h2>
      <div className="mt-3 grid gap-4">
        {customs.length === 0 && (
          <Empty icon={<Inbox size={22} />} title="No custom asks yet"
            hint="When a school ticks features in the plan builder — in their Billing page or on the website — the request lands here with their estimate and phone number." />
        )}
        {customs.map((r) => {
          const sch = r.schoolId ? schoolOf.get(r.schoolId) : undefined;
          const band = SIZE_BANDS.find((b) => b.key === r.sizeBand)?.label ?? r.sizeBand;
          return (
            <Card key={r.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {r.schoolName ?? sch?.name ?? "Unknown school"}
                    <span className="ml-2 font-normal text-muted-foreground">· {r.name} · {r.phone}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {r.createdAt.toISOString().slice(0, 10)} · from the {r.source === "app" ? "app (signed-in admin)" : "public website"}
                    {sch && ` · currently on ${sch.planKey}`}
                  </p>
                </div>
                <Badge tone={TONE[r.status as keyof typeof TONE] ?? "default"}>{r.status}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(r.moduleKeys as string[]).map((k) => (
                  <span key={k} className="rounded-full bg-brand-container px-2.5 py-1 text-[12px] font-medium text-on-brand-container">
                    {MODULE_LABELS[k] ?? k}
                  </span>
                ))}
                <span className="rounded-full bg-muted px-2.5 py-1 text-[12px] font-medium text-muted-foreground">{band} students</span>
              </div>
              <p className="mt-2 text-sm">
                Their estimate: <span className="font-semibold">{ghsPlan(r.estimatePesewas)}/month</span>
                <span className="text-muted-foreground"> — the number they saw; negotiate from here.</span>
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {NEXT[r.status]?.map((s) => (
                  <form key={s} action={setRequestStatus.bind(null, r.id, s)}>
                    <SubmitButton className="rounded-full border border-border px-3 py-1.5 text-[12.5px] font-medium capitalize hover:bg-muted">
                      Mark {s}
                    </SubmitButton>
                  </form>
                ))}
              </div>
              {r.schoolId && r.status !== "approved" && (
                <details className="mt-3 rounded-xl bg-muted p-4">
                  <summary className="cursor-pointer text-sm font-semibold">Approve as their plan…</summary>
                  <form action={approveCustomRequest.bind(null, r.id)} className="mt-3 grid gap-3 sm:grid-cols-4">
                    <label className="grid gap-1 text-sm sm:col-span-1">
                      <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Plan name</span>
                      <input name="name" defaultValue={`${r.schoolName ?? "Custom"} plan`} className={inputCls} />
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">GHS / month</span>
                      <input name="monthly" type="number" step="0.01" min="0"
                        defaultValue={(r.estimatePesewas / 100).toString()} className={inputCls} />
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">GHS / year</span>
                      <input name="yearly" type="number" step="0.01" min="0"
                        defaultValue={((r.estimatePesewas * 10) / 100).toString()} className={inputCls} />
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Student cap</span>
                      <input name="cap" type="number" min="1" placeholder="Unlimited" className={inputCls} />
                    </label>
                    <div className="sm:col-span-4">
                      <SubmitButton className={btnCls} pendingText="Approving…">
                        Approve — create their private plan & move them onto it
                      </SubmitButton>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Only do this AFTER the call — the price here becomes what they pay.
                        Their requested add-ons plus the core come with it; adjust later in Plans.
                      </p>
                    </div>
                  </form>
                </details>
              )}
              {!r.schoolId && r.status !== "approved" && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Website lead — no school account yet. Call them; once they sign up, their in-app
                  request can be approved directly.
                </p>
              )}
            </Card>
          );
        })}
      </div>

      <h2 className="mt-10 font-semibold">Cancellation feedback</h2>
      <div className="mt-3 grid gap-4">
        {cancels.length === 0 && (
          <p className="text-sm text-muted-foreground">None — good sign.</p>
        )}
        {cancels.map((r) => (
          <Card key={r.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {r.schoolName}
                  <span className="ml-2 font-normal text-muted-foreground">· {r.name} · {r.phone}</span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{r.createdAt.toISOString().slice(0, 10)}</p>
              </div>
              <Badge tone={r.status === "new" ? "danger" : "default"}>{r.status}</Badge>
            </div>
            <p className="mt-2 text-sm"><span className="font-medium capitalize">{r.reason}</span> — {r.message}</p>
            <div className="mt-3 flex gap-2">
              {r.status === "new" && (
                <form action={setRequestStatus.bind(null, r.id, "contacted")}>
                  <SubmitButton className="rounded-full border border-border px-3 py-1.5 text-[12.5px] font-medium hover:bg-muted">
                    Mark contacted
                  </SubmitButton>
                </form>
              )}
              {r.status !== "closed" && (
                <form action={setRequestStatus.bind(null, r.id, "closed")}>
                  <SubmitButton className="rounded-full border border-border px-3 py-1.5 text-[12.5px] font-medium hover:bg-muted">
                    Close
                  </SubmitButton>
                </form>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
