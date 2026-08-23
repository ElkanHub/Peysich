import { eq } from "drizzle-orm";
import { db } from "@/db";
import { plans, user } from "@/db/schema";
import { updatePlan } from "../actions";
import { Card, DataTable, PageHeader, Tr, Td, btnGhostCls } from "@/ui/kit";
import { InviteAdmin } from "./invite";

const STANDARD = ["trial", "starter", "standard", "premium"];

/** Platform settings: plan pricing (live for new signups) + platform staff. */
export default async function PlatformSettings() {
  const [allPlans, staff] = await Promise.all([
    db.select().from(plans),
    db.select().from(user).where(eq(user.role, "platform_admin")),
  ]);
  const rows = STANDARD.map((k) => allPlans.find((p) => p.key === k)).filter(Boolean);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Platform settings" sub="Plan pricing and platform staff" />

      <Card>
        <h2 className="font-semibold">Plan pricing</h2>
        <p className="mt-1 text-[14px] text-muted-foreground">
          Changes apply to new checkouts immediately; existing paid periods keep their price.
          Custom per-school plans are composed on each school&apos;s page.
        </p>
        <div className="mt-3">
          <DataTable head={["Plan", "GHS/month", "GHS/year", "Student cap", ""]}>
            {rows.map((p) => (
              <Tr key={p!.key}>
                <Td className="font-medium">{p!.name}</Td>
                <Td>
                  <form id={`plan-${p!.key}`} action={updatePlan.bind(null, p!.key)}>
                    <input name="priceMonthGhs" type="number" step="0.01"
                      defaultValue={p!.pricePerMonthPesewas / 100}
                      className="w-24 rounded-md border border-border px-2 py-1 text-sm" />
                  </form>
                </Td>
                <Td>
                  <input name="priceYearGhs" form={`plan-${p!.key}`} type="number" step="0.01"
                    defaultValue={p!.pricePerYearPesewas / 100}
                    className="w-24 rounded-md border border-border px-2 py-1 text-sm" />
                </Td>
                <Td>
                  <input name="studentCap" form={`plan-${p!.key}`} type="number"
                    defaultValue={p!.studentCap ?? ""} placeholder="unlimited"
                    className="w-28 rounded-md border border-border px-2 py-1 text-sm" />
                </Td>
                <Td>
                  <button form={`plan-${p!.key}`} className={btnGhostCls + " h-8 text-[13px]"}>Save</button>
                </Td>
              </Tr>
            ))}
          </DataTable>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold">Platform staff</h2>
        <ul className="mt-2 space-y-1.5 text-sm">
          {staff.map((s) => (
            <li key={s.id} className="flex justify-between">
              <span className="font-medium">{s.name}</span>
              <span className="text-muted-foreground">{s.email}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 border-t border-border pt-4">
          <InviteAdmin />
        </div>
      </Card>
    </div>
  );
}
