import { desc } from "drizzle-orm";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { setLeadStatus } from "../actions";
import { DataTable, Empty, PageHeader, Tr, Td, Badge } from "@/ui/kit";

const TONE = { new: "danger", contacted: "warning", converted: "success", lost: "default" } as const;

/** Leads captured from the marketing page — the sales pipeline. */
export default async function Leads() {
  const rows = await db.select().from(leads).orderBy(desc(leads.createdAt)).limit(100);
  const counts = { new: 0, contacted: 0, converted: 0, lost: 0 } as Record<string, number>;
  for (const l of rows) counts[l.status] = (counts[l.status] ?? 0) + 1;

  return (
    <div>
      <PageHeader title="Leads"
        sub={`${counts.new} new · ${counts.contacted} contacted · ${counts.converted} converted`} />
      {rows.length === 0 ? (
        <Empty title="No leads yet"
          hint="The 'Request a demo' form on the marketing page lands here the moment someone submits it." />
      ) : (
        <DataTable head={["Contact", "School", "Message", "Received", "Status", "Move to"]}>
          {rows.map((l) => (
            <Tr key={l.id}>
              <Td>
                <span className="font-medium">{l.name}</span><br />
                <span className="text-[12px] text-muted-foreground">{l.phone}{l.email && ` · ${l.email}`}</span>
              </Td>
              <Td>{l.schoolName ?? "—"}</Td>
              <Td className="max-w-56 text-[13px] text-muted-foreground">
                <span className="line-clamp-2">{l.message ?? "—"}</span>
              </Td>
              <Td className="whitespace-nowrap text-muted-foreground">{l.createdAt.toISOString().slice(0, 10)}</Td>
              <Td><Badge tone={TONE[l.status as keyof typeof TONE] ?? "default"}>{l.status}</Badge></Td>
              <Td>
                <span className="flex gap-1">
                  {["contacted", "converted", "lost"].filter((s) => s !== l.status).map((s) => (
                    <form key={s} action={setLeadStatus.bind(null, l.id, s, undefined)}>
                      <button className="rounded border border-border px-2 py-1 text-[11px] capitalize hover:bg-muted">{s}</button>
                    </form>
                  ))}
                </span>
              </Td>
            </Tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
