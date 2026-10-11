import Link from "next/link";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { outbox, schools, walletLedger } from "@/db/schema";
import { requireConsole } from "@/core/console";
import { lastMonths, monthLabel } from "@/core/finance";
import { arkeselBalance } from "@/messaging/providers/arkesel";
import { getSettings } from "@/messaging/settings";
import { getPrices, ghs, type Channel } from "@/messaging/wallet";
import { Columns, PILLAR, SegBar, TrendLine } from "@/modules/analytics/charts";
import { Badge, Card, DataTable, PageHeader, Stat, Tabs, Tr, Td, inputCls, btnGhostCls } from "@/ui/kit";
import { FilterSelect, Pagination, SearchBox } from "@/ui/list-controls";

export const dynamic = "force-dynamic";
const PER = 50;
const CHANNEL_WORDS: Record<string, string> = { sms: "SMS", whatsapp: "WhatsApp", telegram: "Telegram", push: "App", email: "Email" };
const CHANNEL_COLORS: Record<string, string> = { sms: "#A33268", whatsapp: "#0B7A50", telegram: "#0084B8", push: "#6455CC", email: "#A8690A" };
const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "default"> = { sent: "success", delivered: "success", read: "success", queued: "default", sending: "default", held: "warning", failed: "danger" };
/** A number or chat id with its middle hidden: enough to recognise, never to dial. */
const mask = (to: string) => to.length > 6 ? `${to.slice(0, 3)}…${to.slice(-3)}` : "…";

/** Messaging (docs/12 §3.7): what goes out, what it costs, what it earns,
 *  whether it arrives — and every send as a log row without its text. */
export default async function Messaging({ searchParams }: {
  searchParams: Promise<{ tab?: string; page?: string; search?: string; school?: string; channel?: string; status?: string; kind?: string; from?: string; to?: string }>;
}) {
  await requireConsole("messaging");
  const sp = await searchParams;
  const tab = sp.tab ?? "overview";
  const allSchools = await db.select({ id: schools.id, name: schools.name }).from(schools).orderBy(schools.name);
  return (
    <div className="space-y-6">
      <PageHeader title="Messaging" sub="Every WhatsApp, SMS, Telegram, app and email message the platform sends: volume, delivery, cost and margin" />
      <Tabs active={tab} tabs={[
        { key: "overview", label: "Overview", href: "/platform/messaging" },
        { key: "log", label: "Log", href: "/platform/messaging?tab=log" },
      ]} />
      {tab === "log" ? <Log sp={sp} allSchools={allSchools} /> : <Overview allSchools={allSchools} />}
    </div>
  );
}

async function Overview({ allSchools }: { allSchools: { id: string; name: string }[] }) {
  const months = lastMonths(6);
  const monthStart = new Date(months.at(-1)! + "-01T00:00:00Z");
  const since = new Date(months[0] + "-01T00:00:00Z");
  const [rows, byMonth, topups, prices, settings, smsLeft] = await Promise.all([
    db.select({
      schoolId: outbox.schoolId, channel: outbox.channel, status: outbox.status, kind: outbox.kind,
      n: sql<number>`count(*)`, parts: sql<number>`coalesce(sum(${outbox.parts}), 0)`, charged: sql<number>`coalesce(sum(${outbox.pricePesewas}), 0)`,
    }).from(outbox).where(gte(outbox.createdAt, monthStart)).groupBy(outbox.schoolId, outbox.channel, outbox.status, outbox.kind),
    db.select({
      month: sql<string>`to_char(${outbox.createdAt}, 'YYYY-MM')`, channel: outbox.channel, status: outbox.status,
      n: sql<number>`count(*)`, parts: sql<number>`coalesce(sum(${outbox.parts}), 0)`, charged: sql<number>`coalesce(sum(${outbox.pricePesewas}), 0)`,
    }).from(outbox).where(gte(outbox.createdAt, since)).groupBy(sql`to_char(${outbox.createdAt}, 'YYYY-MM')`, outbox.channel, outbox.status),
    db.select({ n: sql<number>`coalesce(sum(${walletLedger.pesewas}),0)`, c: sql<number>`count(*)` }).from(walletLedger)
      .where(and(gte(walletLedger.createdAt, monthStart), sql`${walletLedger.kind} in ('topup','manual')`, sql`${walletLedger.pesewas} > 0`)),
    getPrices(), getSettings(), arkeselBalance(),
  ]);
  const cost = (channel: string, n: number, parts: number) => (channel === "sms" ? parts : n) * (prices[channel as Channel]?.costPesewas ?? 0);
  const name = new Map(allSchools.map((s) => [s.id, s.name]));
  const ok = (st: string) => !["held", "failed"].includes(st);
  // this month
  const all = rows.reduce((a, r) => a + Number(r.n), 0);
  const failed = rows.filter((r) => r.status === "failed").reduce((a, r) => a + Number(r.n), 0);
  const held = rows.filter((r) => r.status === "held").reduce((a, r) => a + Number(r.n), 0);
  const arrived = rows.filter((r) => ["sent", "delivered", "read"].includes(r.status)).reduce((a, r) => a + Number(r.n), 0);
  const charged = rows.filter((r) => ok(r.status)).reduce((a, r) => a + Number(r.charged), 0);
  const costAll = rows.filter((r) => ok(r.status)).reduce((a, r) => a + cost(r.channel, Number(r.n), Number(r.parts)), 0);
  const byChannel = Object.keys(CHANNEL_WORDS).map((c) => ({ label: CHANNEL_WORDS[c], color: CHANNEL_COLORS[c],
    v: rows.filter((r) => r.channel === c && ok(r.status)).reduce((a, r) => a + Number(r.n), 0) })).map((p) => ({ ...p, display: p.v.toLocaleString() }));
  const kinds = [...rows.filter((r) => ok(r.status)).reduce((m, r) => { const e = m.get(r.kind) ?? { n: 0, charged: 0 }; e.n += Number(r.n); e.charged += Number(r.charged); return m.set(r.kind, e); }, new Map<string, { n: number; charged: number }>())]
    .sort((a, b) => b[1].n - a[1].n);
  const bySchool = [...rows.filter((r) => ok(r.status) && r.schoolId).reduce((m, r) => {
    const e = m.get(r.schoolId!) ?? { n: 0, charged: 0, cost: 0, held: 0 };
    e.n += Number(r.n); e.charged += Number(r.charged); e.cost += cost(r.channel, Number(r.n), Number(r.parts)); return m.set(r.schoolId!, e);
  }, new Map<string, { n: number; charged: number; cost: number; held: number }>())];
  for (const r of rows) if (r.status === "held" && r.schoolId) { const e = bySchool.find(([id]) => id === r.schoolId); if (e) e[1].held += Number(r.n); }
  bySchool.sort((a, b) => b[1].charged - a[1].charged);
  // the six months
  const trend = months.map((m) => {
    const here = byMonth.filter((r) => r.month === m && ok(r.status));
    return { month: m, n: here.reduce((a, r) => a + Number(r.n), 0), charged: here.reduce((a, r) => a + Number(r.charged), 0),
      cost: here.reduce((a, r) => a + cost(r.channel, Number(r.n), Number(r.parts)), 0) };
  });

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Sent this month" value={all.toLocaleString()} hint={`${arrived.toLocaleString()} arrived · ${all ? Math.round((arrived / Math.max(1, all - held)) * 100) : 0}% of those sent`} />
        <Stat label="Failed · held" value={`${failed} · ${held}`} tone={failed ? "danger" : held ? "warning" : "default"} hint="failed at the provider · held for an empty wallet" />
        <Stat label="Charged to schools" value={ghs(charged)} hint={`provider cost ${ghs(costAll)}`} />
        <Stat label="Margin" value={ghs(charged - costAll)} tone={charged - costAll >= 0 ? "success" : "danger"} hint={`${Number(topups[0].c)} top-up${Number(topups[0].c) === 1 ? "" : "s"} · ${ghs(Number(topups[0].n))} in`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Messages a month</h2>
          <div className="mt-3"><Columns color={PILLAR.attendance} bins={trend.map((t) => ({ label: monthLabel(t.month).slice(0, 3), n: t.n }))} /></div>
          <h3 className="mt-4 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">By channel, this month</h3>
          <div className="mt-2"><SegBar parts={byChannel} /></div>
        </Card>
        <Card>
          <h2 className="font-semibold">Charged against cost</h2>
          <div className="mt-3"><TrendLine points={trend.map((t) => ({ label: monthLabel(t.month), v: t.charged }))} color={PILLAR.money} fmt={ghs} /></div>
          <div className="mt-2">
            <DataTable head={["Month", "Messages", "Charged", "Cost", "Margin"]}>
              {[...trend].reverse().map((t) => (
                <Tr key={t.month}>
                  <Td className="text-muted-foreground">{monthLabel(t.month)}</Td>
                  <Td data-nums="">{t.n.toLocaleString()}</Td><Td data-nums="">{ghs(t.charged)}</Td><Td data-nums="">{ghs(t.cost)}</Td>
                  <Td className={t.charged - t.cost >= 0 ? "text-success" : "text-danger"} data-nums="">{ghs(t.charged - t.cost)}</Td>
                </Tr>
              ))}
            </DataTable>
          </div>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold">By kind, this month</h2>
          <div className="mt-3">
            <DataTable head={["Kind", "Messages", "Charged"]}>
              {kinds.map(([k, v]) => <Tr key={k}><Td className="font-medium">{k}</Td><Td data-nums="">{v.n.toLocaleString()}</Td><Td data-nums="">{ghs(v.charged)}</Td></Tr>)}
            </DataTable>
            {kinds.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Nothing sent this month yet.</p>}
          </div>
        </Card>
        <Card>
          <h2 className="font-semibold">Providers</h2>
          <ul className="mt-2 space-y-1 text-sm">
            <li>Arkesel SMS left: <b data-nums="">{smsLeft ?? "not connected"}</b></li>
            <li>Resend emails this month: <b data-nums="">{rows.filter((r) => r.channel === "email").reduce((a, r) => a + Number(r.n), 0)}</b> of 3,000 on the free plan</li>
            <li>Meta quality rating: <b>{settings.wa_quality || "not read yet"}</b> · {settings.wa_daily_cap} WhatsApp recipients a day</li>
            <li>Prices: WhatsApp {prices.whatsapp.pricePesewas}p · SMS {prices.sms.pricePesewas}p a part · <Link href="/platform/settings" className="text-primary">change</Link></li>
          </ul>
        </Card>
      </div>
      <Card>
        <h2 className="font-semibold">By school, this month</h2>
        <div className="mt-3">
          <DataTable head={["School", "Messages", "Charged", "Cost", "Margin", "Held"]}>
            {bySchool.map(([id, v]) => (
              <Tr key={id}>
                <Td><Link href={`/platform/messaging?tab=log&school=${id}`} className="font-medium text-primary hover:underline">{name.get(id) ?? "—"}</Link></Td>
                <Td data-nums="">{v.n.toLocaleString()}</Td><Td data-nums="">{ghs(v.charged)}</Td><Td data-nums="">{ghs(v.cost)}</Td>
                <Td className={v.charged - v.cost >= 0 ? "text-success" : "text-danger"} data-nums="">{ghs(v.charged - v.cost)}</Td>
                <Td className={v.held ? "text-warning" : "text-muted-foreground"} data-nums="">{v.held || "—"}</Td>
              </Tr>
            ))}
          </DataTable>
          {bySchool.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Nothing sent this month yet.</p>}
        </div>
      </Card>
    </>
  );
}

async function Log({ sp, allSchools }: { sp: Record<string, string | undefined>; allSchools: { id: string; name: string }[] }) {
  const page = Math.max(1, Number(sp.page) || 1);
  const where = and(
    sp.school ? eq(outbox.schoolId, sp.school) : undefined,
    sp.channel ? eq(outbox.channel, sp.channel) : undefined,
    sp.status ? eq(outbox.status, sp.status) : undefined,
    sp.kind ? eq(outbox.kind, sp.kind) : undefined,
    sp.from ? gte(outbox.createdAt, new Date(sp.from)) : undefined,
    sp.to ? sql`${outbox.createdAt} < (${sp.to}::date + 1)` : undefined,
    sp.search ? sql`(${outbox.kind} ilike ${"%" + sp.search + "%"} or ${outbox.error} ilike ${"%" + sp.search + "%"})` : undefined,
  );
  const [rows, [{ n }], kinds] = await Promise.all([
    db.select().from(outbox).where(where).orderBy(desc(outbox.createdAt)).limit(PER).offset((page - 1) * PER),
    db.select({ n: sql<number>`count(*)` }).from(outbox).where(where),
    db.select({ kind: outbox.kind }).from(outbox).groupBy(outbox.kind).orderBy(outbox.kind),
  ]);
  const name = new Map(allSchools.map((s) => [s.id, s.name]));
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox placeholder="Kind or error…" />
        <FilterSelect name="school" allLabel="Every school" options={allSchools.map((s) => ({ value: s.id, label: s.name }))} />
        <FilterSelect name="channel" allLabel="Every channel" options={Object.entries(CHANNEL_WORDS).map(([v, l]) => ({ value: v, label: l }))} />
        <FilterSelect name="status" allLabel="Every state" options={["sent", "delivered", "read", "queued", "held", "failed"].map((v) => ({ value: v, label: v }))} />
        <FilterSelect name="kind" allLabel="Every kind" options={kinds.map((k) => ({ value: k.kind, label: k.kind }))} />
        <form className="flex items-center gap-1.5 text-[13px]">
          {Object.entries(sp).filter(([k]) => !["from", "to", "page"].includes(k)).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
          <input type="date" name="from" defaultValue={sp.from} className={inputCls + " h-9 w-36"} />
          <span className="text-muted-foreground">to</span>
          <input type="date" name="to" defaultValue={sp.to} className={inputCls + " h-9 w-36"} />
          <button className={btnGhostCls + " h-9"}>Apply</button>
        </form>
      </div>
      <DataTable head={["When", "School", "Kind", "Channel", "To", "State", "Parts", "Charged", "Error"]}>
        {rows.map((r) => (
          <Tr key={r.id}>
            <Td className="whitespace-nowrap text-[12.5px] text-muted-foreground" data-nums="">{r.createdAt.toISOString().slice(0, 16).replace("T", " ")}</Td>
            <Td>{r.schoolId ? name.get(r.schoolId) ?? "—" : <span className="text-muted-foreground">platform</span>}</Td>
            <Td className="font-medium">{r.kind}</Td>
            <Td>{CHANNEL_WORDS[r.channel] ?? r.channel}</Td>
            <Td className="font-mono text-[12px] text-muted-foreground">{r.channel === "push" ? "app" : mask(r.to)}</Td>
            <Td><Badge tone={STATUS_TONE[r.status] ?? "default"}>{r.status}</Badge></Td>
            <Td data-nums="">{r.parts}</Td>
            <Td data-nums="">{r.pricePesewas ? ghs(r.pricePesewas) : "—"}</Td>
            <Td className="max-w-[16rem] truncate text-[12.5px] text-danger">{r.error ?? ""}</Td>
          </Tr>
        ))}
      </DataTable>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">Nothing matches.</p>}
      <Pagination page={page} count={Number(n)} perPage={PER} />
      <p className="text-[12.5px] text-faint">The log shows what was sent and whether it arrived, never the text. Numbers are hidden in the middle.</p>
    </>
  );
}
