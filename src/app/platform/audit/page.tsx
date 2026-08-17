import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { platformAuditLogs, schools, user } from "@/db/schema";
import { DataTable, PageHeader, Tr, Td } from "@/ui/kit";

export default async function AuditLog() {
  const rows = await db.select({
    action: platformAuditLogs.action, detail: platformAuditLogs.detail,
    createdAt: platformAuditLogs.createdAt, schoolName: schools.name, actor: user.name,
  }).from(platformAuditLogs)
    .leftJoin(schools, eq(platformAuditLogs.schoolId, schools.id))
    .leftJoin(user, eq(platformAuditLogs.actorUserId, user.id))
    .orderBy(desc(platformAuditLogs.createdAt)).limit(100);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Audit log" sub="Last 100 platform actions" />
      <DataTable head={["When", "Actor", "Action", "School", "Detail"]}>
        {rows.map((r, i) => (
          <Tr key={i}>
            <Td className="whitespace-nowrap text-xs">{r.createdAt.toISOString().slice(0, 16).replace("T", " ")}</Td>
            <Td>{r.actor ?? "—"}</Td>
            <Td className="font-mono text-xs">{r.action}</Td>
            <Td>{r.schoolName ?? "—"}</Td>
            <Td className="max-w-48 truncate text-xs text-muted-foreground">{JSON.stringify(r.detail)}</Td>
          </Tr>
        ))}
      </DataTable>
    </div>
  );
}
