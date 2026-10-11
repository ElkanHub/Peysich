import Link from "next/link";
import { requireConsole } from "@/core/console";
import { ghs, perSchool } from "@/core/finance";
import { Badge, DataTable, PageHeader, Tabs, Tr, Td } from "@/ui/kit";

/** Every school as a money row: lifetime, by stream, last paid, next
 *  renewal, messaging spent, fees processed. Opens into the statement. */
export default async function FinanceBySchool({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  await requireConsole("financials");
  const { sort = "lifetime" } = await searchParams;
  const rows = await perSchool();
  const key = (r: typeof rows[number]) => sort === "fees" ? r.feesProcessed : sort === "messaging" ? r.messagingSpent : sort === "students" ? r.students : r.lifetime;
  rows.sort((a, b) => key(b) - key(a));
  const ym = (d: Date | null) => d ? d.toISOString().slice(0, 10) : "—";
  const tone = (st: string) => st === "active" ? "success" : st === "trial" ? "brand" : "danger";
  return (
    <div className="space-y-6">
      <PageHeader title="Financials by school" sub="What each school has paid, spent on messaging, and processed in fees" />
      <Tabs active="schools" tabs={[
        { key: "overview", label: "Overview", href: "/platform/financials" },
        { key: "analytics", label: "Analytics", href: "/platform/financials/analytics" },
        { key: "schools", label: "By school", href: "/platform/financials/schools" },
      ]} />
      <div className="flex flex-wrap gap-1 text-[13px]">
        {[["lifetime", "Lifetime revenue"], ["messaging", "Messaging spent"], ["fees", "Fees processed"], ["students", "Students"]].map(([k, l]) => (
          <Link key={k} href={`?sort=${k}`} className={`rounded-md border px-2.5 py-1 ${sort === k ? "border-primary bg-brand-soft text-primary" : "border-border hover:bg-muted"}`}>Sort by {l.toLowerCase()}</Link>
        ))}
      </div>
      <DataTable head={["School", "Status", "Students", "Lifetime", "Plans", "Top-ups", "Install", "Last paid", "Next renewal", "Messaging spent", "Fees processed"]}>
        {rows.map((r) => (
          <Tr key={r.school.id}>
            <Td><Link href={`/platform/financials/schools/${r.school.id}`} className="font-medium text-primary hover:underline">{r.school.name}</Link></Td>
            <Td><Badge tone={tone(r.school.status)}>{r.school.status.replace("_", " ")}</Badge></Td>
            <Td data-nums="">{r.students}</Td>
            <Td className="font-semibold" data-nums="">{ghs(r.lifetime)}</Td>
            <Td data-nums="">{ghs(r.plan)}</Td>
            <Td data-nums="">{ghs(r.messaging)}</Td>
            <Td data-nums="">{ghs(r.installation)}</Td>
            <Td className="whitespace-nowrap text-muted-foreground" data-nums="">{ym(r.lastPaid)}</Td>
            <Td className="whitespace-nowrap text-muted-foreground" data-nums="">{ym(r.nextRenewal)}{r.cycle ? ` · ${r.cycle}` : ""}</Td>
            <Td data-nums="">{ghs(r.messagingSpent)}</Td>
            <Td className="text-muted-foreground" data-nums="">{ghs(r.feesProcessed)}</Td>
          </Tr>
        ))}
      </DataTable>
      <p className="text-[12.5px] text-faint">Fees processed is the school&apos;s own money recorded through the app, never SchoolSpec revenue.</p>
    </div>
  );
}
