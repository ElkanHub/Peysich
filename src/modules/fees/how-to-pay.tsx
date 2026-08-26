import { Phone, ShieldAlert } from "lucide-react";
import { Card } from "@/ui/kit";
import type { FeesConfig } from "./config";

/** The safety block that follows money everywhere — never optional.
 *  Channels and the confirm number come from Fees settings; the warning
 *  itself is part of the trust story and can't be switched off. */
export function HowToPay({ cfg, schoolName }: { cfg: FeesConfig; schoolName: string }) {
  return (
    <Card>
      <h2 className="font-semibold">How to pay {schoolName}</h2>
      <p className="mt-1 text-[13.5px] text-muted-foreground">
        The school collects fees itself — pay any of these ways and the office records it:
      </p>
      {cfg.channelsText ? (
        <ul className="mt-2 space-y-1 text-sm font-medium" data-nums="">
          {cfg.channelsText.split("\n").filter(Boolean).map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      ) : (
        <p className="mt-2 text-sm">Please pay at the school office.</p>
      )}
      <div className="mt-3 rounded-lg border border-warning/60 bg-warning-soft px-3.5 py-3 text-[13.5px]">
        <p className="flex items-start gap-2 font-semibold text-warning">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" />
          Before you send money electronically
        </p>
        <p className="mt-1">
          Confirm the number belongs to the school. Fraudsters copy school messages — if anything
          looks different from what&apos;s written here, <b>call the school first</b>.
        </p>
        {cfg.confirmPhone && (
          <p className="mt-2 inline-flex items-center gap-2 rounded-lg border-2 border-warning bg-card px-3 py-1.5 font-semibold" data-nums="">
            <Phone size={14} /> Call to confirm: {cfg.confirmPhone}
          </p>
        )}
        <p className="mt-2 text-[12px] text-muted-foreground">
          Peysich never collects school fees on a school&apos;s behalf and will never message you asking for payment.
        </p>
      </div>
    </Card>
  );
}
