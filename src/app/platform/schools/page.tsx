import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { schools, plans, subscriptions, walletLedger, leads, students } from "@/db/schema";
import { requireConsole } from "@/core/console";
import { getOnboardingStages, getSchoolUsers } from "@/core/onboarding";
import { STAGES, STAGE_WORDS, nextDue } from "@/messaging/platform";
import { ghs } from "@/messaging/wallet";
import { linkLeadToSchool, setLeadStatus } from "../actions";
import { Badge, DataTable, Empty, PageHeader, Tabs, Tr, Td, Stat, inputCls, btnGhostCls } from "@/ui/kit";
import { FilterSelect, SearchBox } from "@/ui/list-controls";
import { cn } from "@/lib/utils";
import { PipelineBoard } from "./pipeline-board";

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
const preview = ROOT.includes("localhost") || ROOT.endsWith("vercel.app");
const schoolUrl = (slug: string) => (preview ? `/t/${slug}` : `https://${slug}.${ROOT}`);

const LEAD_TONE = { new: "danger", contacted: "warning", converted: "success", lost: "default" } as const;
const STATUS_TONE = (st: string) => st === "active" ? "success" : st === "trial" ? "brand" : "danger";

/** The Schools hub (docs/12 §3.3): the same schools from four angles — the
 *  pipeline board, the list, where each is in its setup, and the leads that
 *  may become one. */
export default async function SchoolsHub({ searchParams }: {
  searchParams: Promise<{ tab?: string; search?: string; status?: string; plan?: string; lead?: string }>;
}) {
  await requireConsole("schools");
  const sp = await searchParams;
  const tab = sp.tab ?? "board";
  const [rows, allPlans, balances, subs, counts] = await Promise.all([
    db.select().from(schools).orderBy(desc(schools.createdAt)).limit(500),
    db.select().from(plans).where(eq(plans.active, true)),
    db.select({ schoolId: walletLedger.schoolId, n: sql<number>`sum(${walletLedger.pesewas})` }).from(walletLedger).groupBy(walletLedger.schoolId),
    db.select().from(subscriptions).orderBy(desc(subscriptions.periodEnd)),
    db.select({ schoolId: students.schoolId, n: sql<number>`count(*)` }).from(students).where(eq(students.status, "active")).groupBy(students.schoolId),
  ]);
  const balance = new Map(balances.map((b) => [b.schoolId, Number(b.n)]));
  const roll = new Map(counts.map((c) => [c.schoolId, Number(c.n)]));
  const latestSub = new Map<string, typeof subs[number]>();
  for (const s of subs) if (!latestSub.has(s.schoolId)) latestSub.set(s.schoolId, s);
  const now = new Date();
  const price = new Map(allPlans.map((p) => [p.key, p.pricePerTermPesewas]));
  const active = rows.filter((s) => s.status === "active");
  const mrr = Math.round(active.reduce((a, s) => a + (price.get(s.planKey) ?? 0), 0) / 4);
  const newLeads = await db.select({ n: sql<number>`count(*)` }).from(leads).where(eq(leads.status, "new"));

  return (
    <div>
      <PageHeader title="Schools" sub="Every school on the platform: where it is, how it is set up, and the leads that may join"
        action={{ href: "/platform/schools/new", label: "New school" }} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active" value={active.length} tone="success" />
        <Stat label="Trials" value={rows.filter((s) => s.status === "trial").length} />
        <Stat label="Past due or suspended" value={rows.filter((s) => ["suspended", "past_due"].includes(s.status)).length}
          tone={rows.some((s) => ["suspended", "past_due"].includes(s.status)) ? "danger" : "default"} />
        <Stat label="New leads" value={Number(newLeads[0].n)} tone={Number(newLeads[0].n) ? "warning" : "default"} hint={`MRR ${ghs(mrr)}`} />
      </div>
      <Tabs active={tab} tabs={[
        { key: "board", label: "Board", href: "/platform/schools" },
        { key: "list", label: `All schools · ${rows.length}`, href: "/platform/schools?tab=list" },
        { key: "onboarding", label: "Onboarding", href: "/platform/schools?tab=onboarding" },
        { key: "leads", label: `Leads${Number(newLeads[0].n) ? ` · ${newLeads[0].n} new` : ""}`, href: "/platform/schools?tab=leads" },
      ]} />

      {tab === "board" && (
        <>
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
        </>
      )}

      {tab === "list" && <SchoolList rows={rows} price={price} roll={roll} balance={balance} latestSub={latestSub} sp={sp} />}
      {tab === "onboarding" && <Onboarding rows={rows} />}
      {tab === "leads" && <Leads rows={rows} status={sp.lead} />}
    </div>
  );
}

async function SchoolList({ rows, price, roll, balance, latestSub, sp }: {
  rows: (typeof schools.$inferSelect)[]; price: Map<string, number>; roll: Map<string, number>; balance: Map<string, number>;
  latestSub: Map<string, typeof subscriptions.$inferSelect>; sp: { search?: string; status?: string; plan?: string };
}) {
  const q = (sp.search ?? "").toLowerCase();
  const list = rows.filter((s) => (!q || s.name.toLowerCase().includes(q) || s.slug.includes(q))
    && (!sp.status || s.status === sp.status) && (!sp.plan || s.planKey === sp.plan));
  return (
    <>
      <div className="mb-3 mt-4 flex flex-wrap items-center gap-2">
        <SearchBox placeholder="Name or slug…" />
        <FilterSelect name="status" allLabel="Every status" options={["trial", "active", "past_due", "suspended", "expired"].map((v) => ({ value: v, label: v.replace("_", " ") }))} />
        <FilterSelect name="plan" allLabel="Every plan" options={[...new Set(rows.map((s) => s.planKey))].map((v) => ({ value: v, label: v }))} />
      </div>
      <DataTable head={["School", "Status", "Stage", "Plan", "Students", "Paid until", "Wallet", "Joined", ""]}>
        {list.map((s) => {
          const sub = latestSub.get(s.id);
          return (
            <Tr key={s.id}>
              <Td><Link href={`/platform/schools/${s.id}`} className="font-medium text-primary">{s.name}</Link><span className="block text-[12.5px] text-muted-foreground">{s.slug}</span></Td>
              <Td><Badge tone={STATUS_TONE(s.status)}>{s.status.replace("_", " ")}</Badge></Td>
              <Td className="text-[13.5px]">{STAGE_WORDS[s.stage] ?? s.stage}</Td>
              <Td className="text-[13.5px]">{s.planKey}{price.get(s.planKey) ? <span className="text-muted-foreground"> · {ghs(price.get(s.planKey)!)}/term</span> : ""}</Td>
              <Td data-nums="">{roll.get(s.id) ?? 0}</Td>
              <Td className="whitespace-nowrap text-muted-foreground" data-nums="">{sub ? sub.periodEnd.toISOString().slice(0, 10) : s.trialEndsAt ? `trial · ${s.trialEndsAt.toISOString().slice(0, 10)}` : "—"}</Td>
              <Td data-nums="">{ghs(balance.get(s.id) ?? 0)}</Td>
              <Td className="whitespace-nowrap text-muted-foreground" data-nums="">{s.createdAt.toISOString().slice(0, 10)}</Td>
              <Td className="whitespace-nowrap text-[13px]"><a href={schoolUrl(s.slug)} className="text-primary">Open →</a> · <Link href={`/platform/audit?school=${s.id}`} className="text-primary">Activity</Link></Td>
            </Tr>
          );
        })}
      </DataTable>
      {list.length === 0 && <p className="mt-3 text-sm text-muted-foreground">No school matches.</p>}
    </>
  );
}

async function Onboarding({ rows }: { rows: (typeof schools.$inferSelect)[] }) {
  const enriched = await Promise.all(rows.slice(0, 60).map(async (s) => ({
    school: s, stages: await getOnboardingStages(s.id), admin: (await getSchoolUsers(s.id)).find((u) => u.role === "admin"),
  })));
  return (
    <div className="mt-4">
      <DataTable head={["School", "Signed up", "Admin contact", "Progress", "Steps"]}>
        {enriched.map(({ school: s, stages, admin }) => {
          const done = stages.filter((st) => st.done).length;
          return (
            <Tr key={s.id}>
              <Td><Link href={`/platform/schools/${s.id}`} className="font-medium text-primary">{s.name}</Link>
                <span className="ml-2"><Badge tone={STATUS_TONE(s.status)}>{s.status.replace("_", " ")}</Badge></span></Td>
              <Td className="text-muted-foreground" data-nums="">{s.createdAt.toISOString().slice(0, 10)}</Td>
              <Td className="text-[14px]">{admin ? <>{admin.name}<br /><span className="text-muted-foreground">{admin.email}{admin.phone ? ` · ${admin.phone}` : ""}</span></> : "—"}</Td>
              <Td><span data-nums="" className={cn("font-semibold", done === stages.length ? "text-success" : done <= 2 ? "text-danger" : "text-warning")}>{done}/{stages.length}</span></Td>
              <Td><span className="flex gap-1">{stages.map((st) => <span key={st.key} title={st.label} className={cn("h-2.5 w-2.5 rounded-full", st.done ? "bg-success" : "bg-danger/40")} />)}</span></Td>
            </Tr>
          );
        })}
      </DataTable>
      <p className="mt-3 text-[13px] text-muted-foreground">Dots, in order: academic year · classes · staff · students · first register · first invoices. Chase the red before they churn.</p>
    </div>
  );
}

async function Leads({ rows, status }: { rows: (typeof schools.$inferSelect)[]; status?: string }) {
  const list = await db.select().from(leads).where(status ? eq(leads.status, status) : undefined).orderBy(desc(leads.createdAt)).limit(200);
  const counts = { new: 0, contacted: 0, converted: 0, lost: 0 } as Record<string, number>;
  for (const l of await db.select({ status: leads.status, n: sql<number>`count(*)` }).from(leads).groupBy(leads.status)) counts[l.status] = Number(l.n);
  const schoolName = new Map(rows.map((s) => [s.id, s.name]));
  return (
    <div className="mt-4">
      <div className="mb-3 flex flex-wrap gap-1 text-[13px]">
        {["", "new", "contacted", "converted", "lost"].map((s) => (
          <Link key={s} href={`/platform/schools?tab=leads${s ? `&lead=${s}` : ""}`}
            className={cn("rounded-md border px-2.5 py-1 capitalize", (status ?? "") === s ? "border-primary bg-brand-soft text-primary" : "border-border hover:bg-muted")}>
            {s || "all"}{s && ` · ${counts[s] ?? 0}`}
          </Link>
        ))}
      </div>
      {list.length === 0 ? (
        <Empty title="No leads here" hint="The walkthrough form on the landing page lands here the moment someone submits it." />
      ) : (
        <DataTable head={["Contact", "School named", "Message", "Received", "Status", "Note", "Became"]}>
          {list.map((l) => (
            <Tr key={l.id}>
              <Td><span className="font-medium">{l.name}</span><br /><span className="text-[13px] text-muted-foreground">{l.phone}{l.email && ` · ${l.email}`}</span></Td>
              <Td>{l.schoolName ?? "—"}</Td>
              <Td className="max-w-56 text-[14px] text-muted-foreground"><span className="line-clamp-2">{l.message ?? "—"}</span></Td>
              <Td className="whitespace-nowrap text-muted-foreground" data-nums="">{l.createdAt.toISOString().slice(0, 10)}</Td>
              <Td>
                <Badge tone={LEAD_TONE[l.status as keyof typeof LEAD_TONE] ?? "default"}>{l.status}</Badge>
                <span className="mt-1 flex gap-1">
                  {["contacted", "converted", "lost"].filter((s) => s !== l.status).map((s) => (
                    <form key={s} action={setLeadStatus.bind(null, l.id, s, undefined)}>
                      <button className="rounded border border-border px-1.5 py-0.5 text-[11.5px] capitalize hover:bg-muted">{s}</button>
                    </form>
                  ))}
                </span>
              </Td>
              <Td>
                <form action={setLeadStatus.bind(null, l.id, l.status)} className="flex gap-1">
                  <input name="note" defaultValue={l.note ?? ""} placeholder="Called, said…" className={inputCls + " h-8 w-40 text-[13px]"} />
                  <button className={btnGhostCls + " h-8 px-2 text-[12px]"}>Save</button>
                </form>
              </Td>
              <Td>
                {l.schoolId ? (
                  <Link href={`/platform/schools/${l.schoolId}`} className="text-[13.5px] font-medium text-primary hover:underline">{schoolName.get(l.schoolId) ?? "a school"}</Link>
                ) : (
                  <form action={linkLeadToSchool.bind(null, l.id)} className="flex gap-1">
                    <select name="schoolId" className={inputCls + " h-8 w-36 text-[13px]"} defaultValue="">
                      <option value="">pick the school…</option>
                      {rows.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <button className={btnGhostCls + " h-8 px-2 text-[12px]"}>Link</button>
                  </form>
                )}
              </Td>
            </Tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
