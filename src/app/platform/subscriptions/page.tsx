import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { schools, subscriptions } from "@/db/schema";
import { extendTrial, setSchoolStatus } from "../actions";
import { Card, DataTable, PageHeader, Tr, Td, Badge, btnGhostCls } from "@/ui/kit";

const ghs = (p: number) => `GHS ${(p / 100).toLocaleString()}`;

/** Subscriptions & trials: who pays, until when, and the levers (extend / suspend). */
export default async function Subscriptions() {
  const [allSchools, subs] = await Promise.all([
    db.select().from(schools).orderBy(desc(schools.createdAt)),
    db.select({
      id: subscriptions.id, planKey: subscriptions.planKey, status: subscriptions.status,
      amount: subscriptions.amountPesewas, start: subscriptions.periodStart,
      end: subscriptions.periodEnd, name: schools.name, schoolId: subscriptions.schoolId,
    }).from(subscriptions)
      .innerJoin(schools, eq(subscriptions.schoolId, schools.id))
      .orderBy(desc(subscriptions.createdAt)).limit(100),
  ]);
  const trials = allSchools.filter((s) => s.status === "trial" || s.status === "expired");
  const now = Date.now();

  return (
    <div className="space-y-6">
      <PageHeader title="Subscriptions" sub="Paid periods, trials and the dunning levers" />

      <Card>
        <h2 className="font-semibold">Trials</h2>
        <div className="mt-3">
          <DataTable head={["School", "Status", "Trial ends", "Days left", "Actions"]}>
            {trials.map((s) => {
              const days = s.trialEndsAt ? Math.ceil((+s.trialEndsAt - now) / 86400000) : null;
              return (
                <Tr key={s.id}>
                  <Td><Link href={`/platform/schools/${s.id}`} className="font-medium text-primary">{s.name}</Link></Td>
                  <Td><Badge tone={s.status === "trial" ? "brand" : "danger"}>{s.status}</Badge></Td>
                  <Td className="text-muted-foreground">{s.trialEndsAt?.toISOString().slice(0, 10) ?? "—"}</Td>
                  <Td><span className={days !== null && days <= 3 ? "font-medium text-danger" : ""} data-nums="">
                    {days !== null ? `${Math.max(0, days)}d` : "—"}</span></Td>
                  <Td>
                    <form action={extendTrial.bind(null, s.id, 14)}>
                      <button className={btnGhostCls + " h-7 px-2 text-[12px]"}>Extend 14 days</button>
                    </form>
                  </Td>
                </Tr>
              );
            })}
          </DataTable>
          {trials.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No trials right now.</p>}
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold">Paid subscriptions</h2>
        <div className="mt-3">
          <DataTable head={["School", "Plan", "Amount", "Period", "Renews / expires", "Status"]}>
            {subs.map((s) => {
              const daysToEnd = Math.ceil((+s.end - now) / 86400000);
              return (
                <Tr key={s.id}>
                  <Td><Link href={`/platform/schools/${s.schoolId}`} className="font-medium text-primary">{s.name}</Link></Td>
                  <Td className="capitalize">{s.planKey}</Td>
                  <Td data-nums="">{ghs(s.amount)}</Td>
                  <Td className="whitespace-nowrap text-muted-foreground">
                    {s.start.toISOString().slice(0, 10)} → {s.end.toISOString().slice(0, 10)}
                  </Td>
                  <Td><span className={daysToEnd <= 14 ? "font-medium text-warning" : "text-muted-foreground"} data-nums="">
                    {daysToEnd > 0 ? `in ${daysToEnd}d` : `${-daysToEnd}d overdue`}</span></Td>
                  <Td><Badge tone={s.status === "active" ? "success" : "danger"}>{s.status}</Badge></Td>
                </Tr>
              );
            })}
          </DataTable>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold">Dunning levers</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Suspend/reactivate lives on each school&apos;s page; the daily sweep moves overdue schools
          to past-due (7-day grace) then suspended automatically.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {allSchools.filter((s) => s.status === "past_due").map((s) => (
            <form key={s.id} action={setSchoolStatus.bind(null, s.id, "suspended")}>
              <button className={btnGhostCls + " h-8 text-[12px]"}>Suspend {s.name} now</button>
            </form>
          ))}
          {allSchools.every((s) => s.status !== "past_due") &&
            <p className="text-sm text-muted-foreground">Nothing past due ✓</p>}
        </div>
      </Card>
    </div>
  );
}
