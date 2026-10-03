import { eq } from "drizzle-orm";
import { db } from "@/db";
import { messageTemplates, plans, user } from "@/db/schema";
import { updatePlan } from "../actions";
import { Card, DataTable, PageHeader, Tr, Td, btnGhostCls } from "@/ui/kit";
import { InviteAdmin } from "./invite";
import { connectTelegram, saveMessagingSettings, syncTemplatesNow, updatePriceSetting } from "@/messaging/actions";
import { EDITABLE_SETTINGS, getSettings } from "@/messaging/settings";
import { PLATFORM_TEMPLATES, TEMPLATES } from "@/messaging/templates";
import { CHANNELS, getPrices } from "@/messaging/wallet";

const STANDARD = ["trial", "starter", "standard", "premium"];

/** Platform settings: plan pricing (live for new signups) + platform staff. */
export default async function PlatformSettings() {
  const [allPlans, staff, prices, settings, verdicts] = await Promise.all([
    db.select().from(plans),
    db.select().from(user).where(eq(user.role, "platform_admin")),
    getPrices(),
    getSettings(),
    db.select().from(messageTemplates),
  ]);
  // every WhatsApp template the code sends, with Meta's verdict on it
  const verdict = new Map(verdicts.map((v) => [v.name, v.status]));
  const waNames = [...new Set([
    ...Object.values(TEMPLATES).flatMap((t) => "wa" in t ? [t.wa.name] : []), ...Object.keys(PLATFORM_TEMPLATES),
  ])];
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
        <h2 className="font-semibold">Messaging prices</h2>
        <p className="mt-1 text-[14px] text-muted-foreground">
          Pesewas per message (per part for SMS). Price is what the school&apos;s wallet pays; cost is what the
          provider charges us. Changes apply to the next send.
        </p>
        <div className="mt-3">
          <DataTable head={["Channel", "Price (p)", "Cost (p)", ""]}>
            {CHANNELS.map((c) => (
              <Tr key={c}>
                <Td className="font-medium">{c === "sms" ? "SMS" : c === "whatsapp" ? "WhatsApp" : c === "push" ? "App notification" : c[0].toUpperCase() + c.slice(1)}</Td>
                <Td>
                  <form id={`price-${c}`} action={updatePriceSetting.bind(null, c)}>
                    <input name="price" type="number" min={0} defaultValue={prices[c].pricePesewas}
                      className="w-20 rounded-md border border-border px-2 py-1 text-sm" />
                  </form>
                </Td>
                <Td>
                  <input name="cost" form={`price-${c}`} type="number" min={0} defaultValue={prices[c].costPesewas}
                    className="w-20 rounded-md border border-border px-2 py-1 text-sm" />
                </Td>
                <Td><button form={`price-${c}`} className={btnGhostCls + " h-8 text-[13px]"}>Save</button></Td>
              </Tr>
            ))}
          </DataTable>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold">Messaging settings</h2>
        <form action={saveMessagingSettings} className="mt-3 grid gap-3 sm:grid-cols-2">
          {EDITABLE_SETTINGS.map(([key, label]) => (
            <label key={key} className="text-sm">{label}<br />
              <input name={key} defaultValue={settings[key]} className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm" />
            </label>
          ))}
          <button className={btnGhostCls + " sm:col-span-2"}>Save messaging settings</button>
        </form>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4 text-sm">
          <form action={connectTelegram}><button className={btnGhostCls}>Connect Telegram bots</button></form>
          <span className="text-muted-foreground">
            {settings.ops_chat_id ? "Your alerts go to the chat that sent /start to the ops bot." : "Alerts are off until you send /start to the ops bot."}
          </span>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">WhatsApp templates</h2>
          <form action={syncTemplatesNow}><button className={btnGhostCls + " h-8 text-[13px]"}>Check with Meta</button></form>
        </div>
        <p className="mt-1 text-[14px] text-muted-foreground">
          A message goes by WhatsApp only when its template is approved; until then it goes by SMS.
          Meta&apos;s quality rating: {settings.wa_quality || "not read yet"}.
        </p>
        <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
          {waNames.map((n) => (
            <li key={n} className="flex justify-between gap-2">
              <span className="font-mono text-[13px]">{n}</span>
              <span className={verdict.get(n) === "APPROVED" ? "text-success" : "text-muted-foreground"}>
                {verdict.get(n)?.toLowerCase() ?? "not submitted"}
              </span>
            </li>
          ))}
        </ul>
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
