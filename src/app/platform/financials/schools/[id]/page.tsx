import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { schools, subscriptions, walletLedger } from "@/db/schema";
import { requireConsole } from "@/core/console";
import { STREAM_COLORS, STREAM_WORDS, ghs, revenueEvents } from "@/core/finance";
import { Badge, Card, DataTable, PageHeader, Stat, Tr, Td, btnGhostCls } from "@/ui/kit";

/** One school's statement: every cedi it paid SchoolSpec, its paid periods,
 *  and its messaging wallet, exportable as the report the school may ask for. */
export default async function SchoolStatement({ params }: { params: Promise<{ id: string }> }) {
  await requireConsole("financials");
  const { id } = await params;
  const [school] = await db.select().from(schools).where(eq(schools.id, id));
  if (!school) notFound();
  const [events, subs, ledger] = await Promise.all([
    revenueEvents(id),
    db.select().from(subscriptions).where(eq(subscriptions.schoolId, id)).orderBy(desc(subscriptions.periodStart)),
    db.select().from(walletLedger).where(eq(walletLedger.schoolId, id)).orderBy(desc(walletLedger.createdAt)).limit(200),
  ]);
  const ym = (d: Date) => d.toISOString().slice(0, 10);
  const total = events.reduce((a, e) => a + e.pesewas, 0);
  const balance = ledger.reduce((a, l) => a + l.pesewas, 0);
  const spent = -ledger.filter((l) => l.kind === "charge").reduce((a, l) => a + l.pesewas, 0);

  return (
    <div className="space-y-6">
      <PageHeader title={`${school.name} · statement`} sub={`${school.slug} · ${school.status.replace("_", " ")} · plan ${school.planKey}`}
        action={<a href={`/api/export/finance?school=${id}`} className={btnGhostCls} download>Export this statement (CSV)</a>} />
      <p className="-mt-4 text-[13.5px]"><Link href="/platform/financials/schools" className="text-primary hover:underline">← All schools</Link> · <Link href={`/platform/schools/${id}`} className="text-primary hover:underline">School page</Link> · <Link href={`/platform/audit?school=${id}`} className="text-primary hover:underline">Activity</Link></p>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Paid to SchoolSpec" value={ghs(total)} tone="success" hint={`${events.length} transaction${events.length === 1 ? "" : "s"}`} />
        <Stat label="Subscriptions" value={ghs(events.filter((e) => e.stream === "plan").reduce((a, e) => a + e.pesewas, 0))} hint={`${subs.length} paid period${subs.length === 1 ? "" : "s"}`} />
        <Stat label="Messaging balance" value={ghs(balance)} hint={`${ghs(spent)} spent on messages`} />
        <Stat label="Next renewal" value={subs[0] ? ym(subs[0].periodEnd) : "—"} hint={subs[0] ? `${subs[0].planKey} · by the ${subs[0].cycle}` : "no paid period"} />
      </div>

      <Card>
        <h2 className="font-semibold">Transactions</h2>
        <div className="mt-3">
          <DataTable head={["Date", "Stream", "Detail", "Reference", "Amount"]}>
            {events.map((e) => (
              <Tr key={e.reference + e.at.toISOString()}>
                <Td className="whitespace-nowrap text-muted-foreground" data-nums="">{ym(e.at)}</Td>
                <Td><span className="inline-flex items-center gap-1.5 text-[13px]"><i className="h-2.5 w-2.5 rounded-[3px]" style={{ background: STREAM_COLORS[e.stream] }} />{STREAM_WORDS[e.stream]}</span></Td>
                <Td className="text-[13px] text-muted-foreground">{e.detail}</Td>
                <Td className="font-mono text-[12px] text-muted-foreground">{e.reference}</Td>
                <Td className="font-semibold" data-nums="">{ghs(e.pesewas)}</Td>
              </Tr>
            ))}
          </DataTable>
          {events.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Nothing paid yet.</p>}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Paid periods</h2>
          <div className="mt-3">
            <DataTable head={["Plan", "Cycle", "From", "To", "Amount", "State"]}>
              {subs.map((s) => (
                <Tr key={s.id}>
                  <Td className="font-medium">{s.planKey}</Td>
                  <Td>{s.cycle}</Td>
                  <Td className="text-muted-foreground" data-nums="">{ym(s.periodStart)}</Td>
                  <Td className="text-muted-foreground" data-nums="">{ym(s.periodEnd)}</Td>
                  <Td data-nums="">{ghs(s.amountPesewas)}</Td>
                  <Td><Badge tone={s.periodEnd > new Date() ? "success" : "default"}>{s.periodEnd > new Date() ? "current" : "ended"}</Badge></Td>
                </Tr>
              ))}
            </DataTable>
          </div>
        </Card>
        <Card>
          <h2 className="font-semibold">Messaging wallet</h2>
          <div className="mt-3">
            <DataTable head={["Date", "Entry", "Note", "GHS"]}>
              {ledger.slice(0, 40).map((l) => (
                <Tr key={l.id}>
                  <Td className="whitespace-nowrap text-muted-foreground" data-nums="">{ym(l.createdAt)}</Td>
                  <Td className="capitalize">{l.kind.replace("_", " ")}{l.channel ? ` · ${l.channel}` : ""}</Td>
                  <Td className="max-w-[14rem] truncate text-[13px] text-muted-foreground">{l.note ?? l.reference ?? ""}</Td>
                  <Td className={l.pesewas < 0 ? "text-danger" : "text-success"} data-nums="">{(l.pesewas / 100).toFixed(2)}</Td>
                </Tr>
              ))}
            </DataTable>
          </div>
        </Card>
      </div>
    </div>
  );
}
