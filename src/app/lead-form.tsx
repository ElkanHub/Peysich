"use client";
import { useActionState } from "react";
import { submitLead } from "./lead-actions";
import { Field, inputCls, btnCls } from "@/ui/kit";

export function LeadForm() {
  const [state, action, pending] = useActionState(submitLead, null);
  if (state && "ok" in state!)
    return (
      <div className="rounded-lg border border-border bg-background p-6 text-center">
        <p className="text-lg font-semibold text-success">Thank you! 🎉</p>
        <p className="mt-1 text-[14px] text-muted-foreground">We&apos;ll reach out within one working day.</p>
      </div>
    );
  return (
    <form action={action} className="rounded-lg border border-border bg-background p-6 shadow-[var(--shadow-sm)]">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Your name"><input name="name" required className={inputCls} /></Field>
        <Field label="Phone (we'll call)"><input name="phone" required className={inputCls} /></Field>
        <Field label="School name"><input name="schoolName" className={inputCls} /></Field>
        <Field label="Email (optional)"><input name="email" type="email" className={inputCls} /></Field>
      </div>
      <input name="company" className="hidden" tabIndex={-1} autoComplete="off" aria-hidden />
      <div className="mt-3">
        <Field label="Anything specific you want to see?">
          <textarea name="message" rows={2} className={inputCls} />
        </Field>
      </div>
      {state && "error" in state! && <p className="mt-2 text-[14px] text-danger">{state.error}</p>}
      <button disabled={pending} className={btnCls + " mt-4 w-full"}>
        {pending ? "Sending…" : "Request a walkthrough"}
      </button>
    </form>
  );
}
