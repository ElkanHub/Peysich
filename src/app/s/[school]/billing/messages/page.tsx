import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { outbox } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { getBalance, ghs, ledgerRows } from "@/messaging/wallet";
import { Card, PageHeader } from "@/ui/kit";
import { cn } from "@/lib/utils";

const when = (d: Date) => d.toLocaleString("en-GB", {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Accra",
});

const LEDGER_WORDS: Record<string, string> = {
  topup: "Top-up", charge: "Message", refund: "Refund for a message that failed", starting_credit: "Starting credit", manual: "Credit from SchoolSpec",
};

const CHANNEL_WORDS: Record<string, string> = { sms: "SMS", whatsapp: "WhatsApp", telegram: "Telegram", push: "App", email: "Email" };
const STATUS_WORDS: Record<string, string> = {
  queued: "on its way", sending: "on its way", sent: "sent", delivered: "delivered", read: "read",
  failed: "failed", held: "not sent: balance empty",
};

/** Every top-up and every message, newest first. One page, two lists. */
export default async function MessagingHistory({ params }: { params: Promise<{ school: string }> }) {
  const { school: slug } = await params;
  const { school } = await requireSchool(slug, ["admin"]);
  const [balance, ledger, sends] = await Promise.all([
    getBalance(school.id), ledgerRows(school.id, 300),
    db.select().from(outbox).where(and(eq(outbox.schoolId, school.id), eq(outbox.plane, "school")))
      .orderBy(desc(outbox.createdAt)).limit(300),
  ]);
  const money = ledger.filter((r) => r.kind !== "charge");

  return (
    <div className="max-w-3xl">
      <PageHeader title="Messages and top-ups" sub={`Balance ${ghs(balance)}.`}
        action={{ href: "/billing", label: "Back to Billing" }} />

      <Card className="mb-6">
        <h2 className="font-semibold">Money in</h2>
        {money.length === 0 && <p className="mt-2 text-[15px] text-muted-foreground">No top-ups yet.</p>}
        <ul className="mt-2 divide-y divide-border text-[15px]">
          {money.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2">
              <span>
                <span className="font-medium">{LEDGER_WORDS[r.kind] ?? r.kind}</span>
                <span className="block text-[13px] text-muted-foreground">{when(r.createdAt)}{r.note && r.kind === "manual" ? ` · ${r.note}` : ""}</span>
              </span>
              <span className={cn("font-semibold", r.pesewas < 0 && "text-danger")} data-nums="">
                {r.pesewas > 0 ? "+" : ""}{ghs(r.pesewas)}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="font-semibold">Every message</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">Latest 300. Price is what left the balance; Telegram, email and app notifications are free.</p>
        {sends.length === 0 && <p className="mt-2 text-[15px] text-muted-foreground">Nothing sent yet.</p>}
        <div className="overflow-x-auto"><table className="mt-2 w-full min-w-[640px] text-[14px]">
          <thead>
            <tr className="text-left font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <th className="py-2 pr-3">When</th><th className="pr-3">Kind</th><th className="pr-3">To</th>
              <th className="pr-3">Channel</th><th className="pr-3">Status</th><th className="pr-3 text-right">Parts</th><th className="text-right">Price</th>
            </tr>
          </thead>
          <tbody>
            {sends.map((s) => (
              <tr key={s.id} className="border-t border-border/50">
                <td className="py-2 pr-3 whitespace-nowrap">{when(s.createdAt)}</td>
                <td className="pr-3">{s.kind}</td>
                <td className="pr-3" data-nums="">{s.channel === "push" ? "the app" : s.to}</td>
                <td className="pr-3">{CHANNEL_WORDS[s.channel] ?? s.channel}</td>
                <td className={cn("pr-3", s.status === "held" && "text-warning", s.status === "failed" && "text-danger")}>
                  {STATUS_WORDS[s.status] ?? s.status}</td>
                <td className="pr-3 text-right" data-nums="">{s.channel === "sms" ? s.parts : "—"}</td>
                <td className="text-right" data-nums="">{s.pricePesewas > 0 && s.status !== "failed" ? ghs(s.pricePesewas) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </Card>
      <p className="mt-4 text-[14px]"><Link href="/billing" className="text-primary underline-offset-2 hover:underline">Back to Billing</Link></p>
    </div>
  );
}
