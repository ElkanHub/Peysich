import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { schools, plans } from "@/db/schema";

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
const preview = ROOT.includes("localhost") || ROOT.endsWith("vercel.app");
export const schoolUrl = (slug: string) => (preview ? `/t/${slug}` : `https://${slug}.${ROOT}`);

export default async function PlatformHome() {
  const [rows, allPlans] = await Promise.all([
    db.select().from(schools).limit(50),
    db.select().from(plans).where(eq(plans.active, true)),
  ]);
  const price = new Map(allPlans.map((p) => [p.key, p.pricePerTermPesewas]));
  const active = rows.filter((s) => s.status === "active");
  const termRevenue = active.reduce((a, s) => a + (price.get(s.planKey) ?? 0), 0);
  return (
    <div className="max-w-3xl">
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
          ["Revenue / term", `GHS ${(termRevenue / 100).toLocaleString()}`]].map(([l, v]) => (
          <div key={String(l)} className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">{l}</p>
            <p className="mt-0.5 text-xl font-semibold">{String(v)}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm"><Link href="/platform/audit" className="text-primary underline-offset-2 hover:underline">View audit log →</Link></p>
      <table className="mt-4 w-full text-sm">
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
      </table>
      {rows.length === 0 && (
        <p className="mt-4 text-muted-foreground">No schools yet. Run `npm run db:seed`.</p>
      )}
    </div>
  );
}
