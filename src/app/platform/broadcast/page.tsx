import { desc } from "drizzle-orm";
import { db } from "@/db";
import { platformBroadcasts, schools } from "@/db/schema";
import { sendBroadcast } from "../actions";
import { Card, DataTable, Field, PageHeader, Tr, Td, btnCls, inputCls } from "@/ui/kit";

/** Broadcast: one message → an announcement in every active school. */
export default async function Broadcast() {
  const [past, targets] = await Promise.all([
    db.select().from(platformBroadcasts).orderBy(desc(platformBroadcasts.createdAt)).limit(20),
    db.select().from(schools),
  ]);
  const reach = targets.filter((s) => ["active", "trial", "past_due"].includes(s.status)).length;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Broadcast"
        sub={`Send a platform announcement — it appears in ${reach} schools' announcement feeds`} />
      <Card>
        <form action={sendBroadcast} className="space-y-3">
          <Field label="Title"><input name="title" required className={inputCls}
            placeholder="e.g. New feature: parents can now pay fees online" /></Field>
          <Field label="Message"><textarea name="body" rows={4} required className={inputCls}
            placeholder="Written to school admins — keep it short and useful." /></Field>
          <button className={btnCls}>Send to {reach} schools</button>
        </form>
      </Card>
      <div>
        <h2 className="mb-2 font-semibold">Sent</h2>
        <DataTable head={["Date", "Title", "Reached"]}>
          {past.map((b) => (
            <Tr key={b.id}>
              <Td className="whitespace-nowrap text-muted-foreground">{b.createdAt.toISOString().slice(0, 10)}</Td>
              <Td><span className="font-medium">{b.title}</span>
                <p className="line-clamp-1 text-[12px] text-muted-foreground">{b.body}</p></Td>
              <Td data-nums="">{b.schoolsReached} schools</Td>
            </Tr>
          ))}
        </DataTable>
        {past.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Nothing sent yet.</p>}
      </div>
    </div>
  );
}
