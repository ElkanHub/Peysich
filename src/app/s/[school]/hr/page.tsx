import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { leaveRequests, staff } from "@/db/schema";
import { requireModule } from "@/core/school-context";
import { addLeave, setLeaveStatus } from "./actions";
import { Card, DataTable, Field, PageHeader, Tr, Td, inputCls, btnCls } from "@/ui/kit";

export default async function HR({ params }: { params: Promise<{ school: string }> }) {
  const { school: slug } = await params;
  const { school } = await requireModule(slug, "hr", ["admin"]);
  const [rows, sf] = await Promise.all([
    db.select({
      id: leaveRequests.id, from: leaveRequests.fromDate, to: leaveRequests.toDate,
      reason: leaveRequests.reason, status: leaveRequests.status, name: staff.name,
    }).from(leaveRequests)
      .innerJoin(staff, eq(leaveRequests.staffId, staff.id))
      .where(eq(leaveRequests.schoolId, school.id))
      .orderBy(desc(leaveRequests.fromDate)).limit(40),
    db.select().from(staff).where(eq(staff.schoolId, school.id)),
  ]);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Staff HR" sub="Leave tracking" />
      <DataTable head={["Staff", "From", "To", "Reason", "Status", ""]}>
        {rows.map((r) => (
          <Tr key={r.id}>
            <Td className="font-medium">{r.name}</Td>
            <Td>{r.from}</Td><Td>{r.to}</Td>
            <Td>{r.reason ?? "—"}</Td>
            <Td className="capitalize">{r.status}</Td>
            <Td>
              {r.status === "pending" && (
                <div className="flex gap-1">
                  <form action={setLeaveStatus.bind(null, slug, r.id, "approved")}>
                    <button className="rounded bg-success px-2 py-1 text-xs text-white">Approve</button>
                  </form>
                  <form action={setLeaveStatus.bind(null, slug, r.id, "declined")}>
                    <button className="rounded border border-border px-2 py-1 text-xs text-danger">Decline</button>
                  </form>
                </div>
              )}
            </Td>
          </Tr>
        ))}
      </DataTable>
      <Card className="mt-5">
        <h2 className="font-semibold">Record leave</h2>
        <form action={addLeave.bind(null, slug)} className="mt-3 grid grid-cols-4 items-end gap-2">
          <Field label="Staff">
            <select name="staffId" className={inputCls}>{sf.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          </Field>
          <Field label="From"><input name="fromDate" type="date" required className={inputCls} /></Field>
          <Field label="To"><input name="toDate" type="date" required className={inputCls} /></Field>
          <Field label="Reason"><input name="reason" className={inputCls} /></Field>
          <button className={btnCls + " col-span-4"}>Record</button>
        </form>
      </Card>
    </div>
  );
}
