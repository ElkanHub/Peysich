import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { contactChannels } from "@/db/schema";
import { Card, Field, btnCls, btnGhostCls, inputCls } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";
import { saveChannels, unlinkTelegram } from "./contacts";
import { telegramLink } from "./providers/telegram";

/** WhatsApp and Telegram for one guardian or staff member — on their record
 *  (the office) and under My account (the person). `mine` changes the words. */
export async function ChannelsCard({ slug, ownerKind, ownerId, back, mine }: {
  slug: string; ownerKind: "guardian" | "staff"; ownerId: string; back: string; mine?: boolean;
}) {
  const [[c], tg] = await Promise.all([
    db.select().from(contactChannels)
      .where(and(eq(contactChannels.ownerKind, ownerKind), eq(contactChannels.ownerId, ownerId))),
    telegramLink(ownerKind, ownerId),
  ]);
  return (
    <Card>
      <h2 className="font-semibold">{mine ? "How the school messages me" : "WhatsApp and Telegram"}</h2>
      <form action={saveChannels.bind(null, slug, ownerKind, ownerId, back)} className="mt-3 space-y-2.5">
        <Field label="WhatsApp number" optional>
          <input name="whatsapp" type="tel" inputMode="tel" defaultValue={c?.whatsapp ? `+${c.whatsapp}` : ""}
            placeholder="024 000 0000" className={inputCls} />
        </Field>
        <label className="flex items-start gap-2 text-[15px]">
          <input type="checkbox" name="whatsappConsent" defaultChecked={c?.whatsappConsent} className="mt-1" />
          <span>{mine ? "I agree" : "Agrees"} to receive school messages on WhatsApp.</span>
        </label>
        <SubmitButton className={btnGhostCls + " w-full"} pendingText="Saving…">Save WhatsApp</SubmitButton>
      </form>
      <div className="mt-4 border-t border-border pt-3">
        {c?.telegramChatId ? (
          <form action={unlinkTelegram.bind(null, slug, ownerKind, ownerId, back)} className="flex items-center justify-between gap-3 text-[15px]">
            <span><b className="text-success">Telegram is linked.</b> Messages come there free.</span>
            <SubmitButton className="text-[13px] text-danger underline-offset-2 hover:underline" pendingText="…">Unlink</SubmitButton>
          </form>
        ) : tg ? (
          <>
            <a href={tg} target="_blank" rel="noreferrer" className={btnCls + " w-full"}>
              {mine ? "Get messages on Telegram, free" : "Link Telegram"}
            </a>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              {mine ? "Opens Telegram. Tap Start there and you are done."
                : "Open this on the person's own phone and tap Start. They can also do it themselves under My account."}
            </p>
          </>
        ) : (
          <p className="text-[14px] text-muted-foreground">Telegram is not switched on yet.</p>
        )}
      </div>
    </Card>
  );
}
