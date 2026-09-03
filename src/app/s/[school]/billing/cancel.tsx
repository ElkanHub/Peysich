"use client";
import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { requestCancellation } from "@/app/plan-request-actions";
import { cn } from "@/lib/utils";
import { btnDangerCls, btnGhostCls } from "@/ui/kit";

/* ── Cancellation with a reason ─────────────────────────────────────────────
   Leaving is allowed and findable — but WHY is compulsory. The confirm
   button stays off until a reason is picked AND a line is written, and the
   caption says exactly that, so nobody is left guessing at a dead button. */

const REASONS = [
  { key: "cost", label: "It costs too much" },
  { key: "feature", label: "Something I need is missing" },
  { key: "switch", label: "We're moving to another system" },
  { key: "closing", label: "The school is closing / downsizing" },
  { key: "other", label: "Another reason" },
];

export function CancelPlan({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  const ready = reason !== "" && message.trim().length >= 4;

  const submit = () => start(async () => {
    setError(null);
    const r = await requestCancellation(slug, { reason, message });
    if (r?.error) setError(r.error);
    else { setDone(true); setOpen(false); }
  });

  if (done) {
    return (
      <p className="text-sm text-muted-foreground">
        Your cancellation request is in. We&apos;ll call before anything changes — your data stays
        exactly where it is until then.
      </p>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-danger">
        I want to cancel my plan
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-6"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div role="dialog" aria-modal="true" aria-label="Cancel plan"
            className="w-full max-w-md rounded-t-2xl bg-card p-6 shadow-lg sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Before you go —</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tell us why. A person reads every one of these, and we often fix the thing the same week.
                </p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setOpen(false)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"><X size={16} /></button>
            </div>
            <fieldset className="mt-4 grid gap-1.5">
              <legend className="sr-only">Why are you cancelling?</legend>
              {REASONS.map((r) => (
                <label key={r.key} className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                  reason === r.key ? "bg-brand-container text-on-brand-container" : "bg-muted hover:bg-muted/70",
                )}>
                  <input type="radio" name="cancel-reason" value={r.key} checked={reason === r.key}
                    onChange={() => setReason(r.key)} className="accent-primary" />
                  {r.label}
                </label>
              ))}
            </fieldset>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3}
              placeholder="A line or two about it — what happened, what would have kept you…"
              className="mt-3 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary" />
            {error && <p className="mt-2 text-xs font-medium text-danger">{error}</p>}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
              <button type="button" onClick={submit} disabled={!ready || pending} className={cn(btnDangerCls, "disabled:opacity-50")}>
                {pending ? "Sending…" : "Request cancellation"}
              </button>
              <button type="button" onClick={() => setOpen(false)} className={btnGhostCls}>Keep my plan</button>
            </div>
            {!ready && (
              <p className="mt-2 text-xs text-muted-foreground">
                Pick a reason and add a line — then the button unlocks. It&apos;s the one thing we ask.
              </p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Nothing is deleted today: records, report cards and fee history stay intact until the term
              you&apos;ve paid for ends.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
