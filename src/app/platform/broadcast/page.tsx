import { desc } from "drizzle-orm";
import { db } from "@/db";
import { platformBroadcasts, schools } from "@/db/schema";
import { requireConsole } from "@/core/console";
import { sendBroadcast } from "../actions";
import { Badge, Card, DataTable, Field, PageHeader, Tr, Td, btnCls, inputCls } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";
import { BroadcastForm } from "./form";

const ROLE_WORDS: Record<string, string> = { admin: "admins", teacher: "teachers", parent: "parents", student: "students" };

/** Broadcast (docs/12 §3.8): a notice to the feeds and phones of the people
 *  you choose, or a promo that takes the screen when they next open the app. */
export default async function Broadcast() {
  await requireConsole("broadcast");
  const [past, targets] = await Promise.all([
    db.select().from(platformBroadcasts).orderBy(desc(platformBroadcasts.createdAt)).limit(30),
    db.select({ id: schools.id, name: schools.name, status: schools.status }).from(schools).orderBy(schools.name),
  ]);
  const live = targets.filter((s) => ["active", "trial", "past_due"].includes(s.status));
  const now = new Date();
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Broadcast" sub={`${live.length} live schools. A notice lands in their feeds and phones; a promo takes the screen on the next open.`} />
      <Card>
        <form action={sendBroadcast} className="space-y-4">
          <BroadcastForm schools={live} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title"><input name="title" required className={inputCls} placeholder="e.g. Parents can now pay fees by MoMo" /></Field>
            <Field label="Button (promo)" optional><input name="ctaLabel" className={inputCls} placeholder="See how" /></Field>
          </div>
          <Field label="Message"><textarea name="body" rows={4} required className={inputCls} placeholder="Short, useful, in the words the person would use." /></Field>
          <SubmitButton className={btnCls} pendingText="Sending…">Send</SubmitButton>
        </form>
      </Card>
      <div>
        <h2 className="mb-2 font-semibold">Sent</h2>
        <DataTable head={["Date", "Kind", "Title", "To", "Schools", "Runs"]}>
          {past.map((b) => {
            const running = b.kind === "promo" && (!b.endsAt || b.endsAt > now);
            return (
              <Tr key={b.id}>
                <Td className="whitespace-nowrap text-muted-foreground" data-nums="">{b.createdAt.toISOString().slice(0, 10)}</Td>
                <Td><Badge tone={b.kind === "promo" ? (running ? "brand" : "default") : "success"}>{b.kind}{b.kind === "promo" && !running ? " · ended" : ""}</Badge></Td>
                <Td><span className="font-medium">{b.title}</span><p className="line-clamp-1 text-[13px] text-muted-foreground">{b.body}</p></Td>
                <Td className="text-[13px]">{(b.roles ?? []).map((r) => ROLE_WORDS[r] ?? r).join(", ") || "admins"}</Td>
                <Td data-nums="">{b.schoolIds ? `${b.schoolIds.length} chosen` : `${b.schoolsReached} live`}</Td>
                <Td className="whitespace-nowrap text-[13px] text-muted-foreground" data-nums="">{b.kind === "promo" ? `${b.startsAt?.toISOString().slice(0, 10) ?? "now"} → ${b.endsAt?.toISOString().slice(0, 10) ?? "open"} · every ${b.everyHours}h` : "once"}</Td>
              </Tr>
            );
          })}
        </DataTable>
        {past.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Nothing sent yet.</p>}
      </div>
    </div>
  );
}
