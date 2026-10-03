import Link from "next/link";
import { getCurrentTerm } from "@/core/school-context";
import { onlinePayEnabled } from "@/lib/paystack";
import { startWalletTopUp } from "@/messaging/actions";
import {
  ensureStartingCredit, getBalance, getPrices, ghs, MIN_TOPUP_PESEWAS, TOPUP_PRESETS_GHS, usageSince,
} from "@/messaging/wallet";
import { Card, btnCls, btnGhostCls, inputCls } from "@/ui/kit";
import { cn } from "@/lib/utils";

const KIND_WORDS: Record<string, string> = {
  absence: "absence alerts", receipt: "receipts", fees: "bills & reminders", blast: "texts to all parents",
  "staff-nudge": "teacher reminders", login: "logins", "staff-login": "logins", "admission-offer": "admission offers",
  custom: "other", notice: "notices", announcement: "announcements", emergency: "emergencies",
  results: "results", report: "report cards", homework: "homework",
};

/** Billing → Messaging (docs/MESSAGING_BUILD_PLAN.md §5): the balance, Top up,
 *  the prices, this term's use, and the door to the full history. */
export async function MessagingCard({ slug, schoolId }: { slug: string; schoolId: string }) {
  await ensureStartingCredit(schoolId);
  const term = await getCurrentTerm(schoolId);
  const since = new Date(term?.startsAt ?? "2000-01-01"); // no term yet: everything so far
  const [balance, prices, use] = await Promise.all([getBalance(schoolId), getPrices(), usageSince(schoolId, since)]);
  const low = balance < MIN_TOPUP_PESEWAS;

  return (
    <Card className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Messaging balance</p>
          <p className={cn("mt-1 text-3xl font-semibold tracking-tight", balance <= 0 ? "text-danger" : low ? "text-warning" : "")} data-nums="">
            {ghs(balance)}
          </p>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Pays for every WhatsApp and SMS the school sends. Absence alerts and emergencies still go when it is empty.
          </p>
        </div>
        <div className="text-[15px] sm:text-right">
          <p><b>Prices</b> · WhatsApp {prices.whatsapp.pricePesewas}p · SMS {prices.sms.pricePesewas}p per part</p>
          <p className="text-muted-foreground">Telegram and the app: free</p>
        </div>
      </div>

      <form action={startWalletTopUp.bind(null, slug)} className="mt-5 rounded-lg bg-muted/60 p-4">
        <p className="text-[16px] font-semibold">Top up</p>
        {onlinePayEnabled ? (
          <>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TOPUP_PRESETS_GHS.map((a) => (
                <button key={a} name="amount" value={a} className={cn(btnCls, "h-12 text-[16px]")}>GHS {a}</button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input name="custom" type="number" min={MIN_TOPUP_PESEWAS / 100} step="1" inputMode="numeric"
                placeholder="Or another amount, GHS" className={cn(inputCls, "h-12 text-[16px]")} />
              <button className={cn(btnGhostCls, "h-12 shrink-0 px-5 text-[16px]")}>Top up</button>
            </div>
            <p className="mt-2 text-[13px] text-muted-foreground">
              Smallest top-up {ghs(MIN_TOPUP_PESEWAS)}. Pay by MoMo or card on the next screen. Credit never expires.
            </p>
          </>
        ) : (
          <p className="mt-1 text-[15px] text-muted-foreground">
            Online payment is not switched on yet. Call SchoolSpec and the credit is added for you.
          </p>
        )}
      </form>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="font-semibold">This term</p>
          <ul className="mt-1 space-y-1 text-[15px]">
            <li className="flex justify-between"><span>WhatsApp</span><span data-nums="">{use.channels.whatsapp.n.toLocaleString()} messages · {ghs(use.channels.whatsapp.pesewas)}</span></li>
            <li className="flex justify-between"><span>SMS</span><span data-nums="">{use.channels.sms.n.toLocaleString()} parts · {ghs(use.channels.sms.pesewas)}</span></li>
            {use.held > 0 && <li className="flex justify-between text-warning"><span>Not sent, balance empty</span><span data-nums="">{use.held}</span></li>}
            <li className="flex justify-between"><span>Telegram</span><span data-nums="">{use.channels.telegram.n.toLocaleString()} messages · free</span></li>
            <li className="flex justify-between"><span>App</span><span data-nums="">{use.channels.push.n.toLocaleString()} notifications · free</span></li>
            <li className="flex justify-between"><span>Email</span><span data-nums="">{use.channels.email.n.toLocaleString()} · free</span></li>
          </ul>
        </div>
        <div>
          <p className="font-semibold">By kind</p>
          <p className="mt-1 text-[15px] text-muted-foreground">
            {use.byKind.length
              ? use.byKind.map(([k, n]) => `${KIND_WORDS[k] ?? k} ${n}`).join(" · ")
              : "Nothing sent yet this term."}
          </p>
        </div>
      </div>
      <Link href="/billing/messages" className="mt-4 inline-block text-[15px] font-medium text-primary underline-offset-2 hover:underline">
        Every message and top-up →
      </Link>
    </Card>
  );
}
