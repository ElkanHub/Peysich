import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { schools, plans, subscriptions, walletLedger } from "@/db/schema";
import { STAGES, STAGE_WORDS, nextDue } from "@/messaging/platform";
import { ghs } from "@/messaging/wallet";
import { PipelineBoard } from "./pipeline-board";

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
const preview = ROOT.includes("localhost") || ROOT.endsWith("vercel.app");
export const schoolUrl = (slug: string) => (preview ? `/t/${slug}` : `https://${slug}.${ROOT}`);

export default async function PlatformHome() {
  const [rows, allPlans, balances, subs] = await Promise.all([
    db.select().from(schools).limit(200),
    db.select().from(plans).where(eq(plans.active, true)),
    db.select({ schoolId: walletLedger.schoolId, n: sql<number>`sum(${walletLedger.pesewas})` })
      .from(walletLedger).groupBy(walletLedger.schoolId),
    db.select().from(subscriptions).orderBy(desc(subscriptions.periodEnd)),
  ]);
  const balance = new Map(balances.map((b) => [b.schoolId, Number(b.n)]));
  const latestSub = new Map<string, typeof subs[number]>();
  for (const s of subs) if (!latestSub.has(s.schoolId)) latestSub.set(s.schoolId, s); // newest first
  const now = new Date();
  const price = new Map(allPlans.map((p) => [p.key, p.pricePerTermPesewas]));
  const active = rows.filter((s) => s.status === "active");
  const mrr = Math.round(active.reduce((a, s) => a + (price.get(s.planKey) ?? 0), 0) / 4); // a term is four months
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Schools</h1>
        <Link href="/platform/schools/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          New school
        </Link>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-3 text-sm">
        {[["Active schools", active.length], ["Trials", rows.filter((s) => s.status === "trial").length],
          ["Suspended/past due", rows.filter((s) => ["suspended", "past_due"].includes(s.status)).length],
          ["MRR", `GHS ${(mrr / 100).toLocaleString()}`]].map(([l, v]) => (
          <div key={String(l)} className="rounded-lg bg-card p-3 shadow-[var(--shadow-md)]">
            <p className="text-xs text-muted-foreground">{l}</p>
            <p className="mt-0.5 text-xl font-semibold">{String(v)}</p>
          </div>
        ))}
      </div>
      {/* the pipeline: a column per stage, every school a card that can be dragged */}
      <PipelineBoard stages={STAGES.map((k) => [k, STAGE_WORDS[k]])}
        cards={rows.map((s) => {
          const next = nextDue(s, latestSub.get(s.id));
          return {
            id: s.id, name: s.name, stage: s.stage, paused: s.autoMessagesPaused, installation: s.installation,
            days: Math.floor((+now - +s.stageSince) / 86400000), balance: ghs(balance.get(s.id) ?? 0),
            next: next ? `Next: ${next.label}, ${next.due.toISOString().slice(5, 10)}` : "Nothing due",
          };
        })} />
      <p className="mt-2 text-[13px] text-muted-foreground">
        Schools move by themselves as things happen. Drag a card to move one by hand; it stays until the school&apos;s own facts change.
      </p>
      <p className="mt-3 text-sm"><Link href="/platform/audit" className="text-primary underline-offset-2 hover:underline">View audit log →</Link></p>
      <div className="overflow-x-auto"><table className="min-w-[520px] mt-4 w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="py-2">Name</th><th>Slug</th><th>Status</th><th>Plan</th><th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className="border-b border-border hover:bg-muted">
              <td className="py-2">
                <Link href={`/platform/schools/${s.id}`} className="font-medium text-primary">{s.name}</Link>
              </td>
              <td>{s.slug}</td><td>{s.status}</td><td>{s.planKey}</td>
              <td><a href={schoolUrl(s.slug)} className="text-xs text-primary">Open →</a></td>
            </tr>
          ))}
        </tbody>
      </table></div>
      {rows.length === 0 && (
        <p className="mt-4 text-muted-foreground">No schools yet. Run `npm run db:seed`.</p>
      )}
    </div>
  );
}
