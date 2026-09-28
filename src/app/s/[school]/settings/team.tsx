"use client";
import { useActionState, useState } from "react";
import { addTeamMember, type AddMemberResult } from "./team-actions";
import { TAB_KEYS, FEE_ACTION_LABELS } from "@/core/access-const";
import { Field, inputCls, btnCls } from "@/ui/kit";

/** The four big choices, in plain words. "full" = no grants row (a full admin);
 *  the other three are the ACCESS_PRESETS keys, stored as ordinary grants. */
const CHOICES: [string, string, string][] = [
  ["cashier", "Cashier", "Takes payments only"],
  ["bursar", "Bursar", "All of Fees — bills, payments, reminders"],
  ["registrar", "Registrar", "Students, Parents and Admissions"],
  ["full", "Full access", "Everything, always"],
];

/** Presets as big radios; "Customise" unfolds the section + money checkboxes. */
export function AccessPicker({ initial = "cashier", grant }: {
  initial?: string; grant?: { tabs: string[]; fees: Record<string, boolean | undefined> } | null;
}) {
  const [choice, setChoice] = useState(initial);
  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-2">
        {CHOICES.map(([k, label, hint]) => (
          <label key={k} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
            choice === k ? "border-primary bg-brand-soft" : "border-border hover:bg-muted/40"}`}>
            <input type="radio" name="preset" value={k} checked={choice === k}
              onChange={() => setChoice(k)} className="mt-1" />
            <span>
              <span className="block text-[15px] font-semibold">{label}</span>
              <span className="block text-[14px] text-muted-foreground">{hint}</span>
            </span>
          </label>
        ))}
      </div>
      <details open={choice === "custom"} className="mt-3 rounded-lg border border-border px-3 py-2">
        <summary className="cursor-pointer text-[14px] font-medium text-primary"
          onClick={() => setChoice("custom")}>
          Customise — pick sections and money actions by hand
        </summary>
        <input type="radio" name="preset" value="custom" checked={choice === "custom"}
          onChange={() => setChoice("custom")} className="sr-only" />
        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {TAB_KEYS.map((t) => (
            <label key={t.key} className="flex items-center gap-1.5 text-[14px]">
              <input type="checkbox" name={`tab_${t.key}`} defaultChecked={grant?.tabs.includes(t.key)} /> {t.label}
            </label>
          ))}
        </div>
        <p className="mb-1 mt-3 text-[13px] font-semibold text-muted-foreground">Money actions</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {Object.entries(FEE_ACTION_LABELS).map(([k, l]) => (
            <label key={k} className="flex items-center gap-1.5 text-[14px]">
              <input type="checkbox" name={`fee_${k}`} defaultChecked={!!grant?.fees[k]} /> {l}
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}

/** Add a person — name, phone, preset, Add. Shows the issued login once. */
export function AddTeamMember({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(
    async (_prev: AddMemberResult | null, f: FormData) => addTeamMember(slug, f), null);

  if (state && "loginAs" in state)
    return (
      <div className="rounded-lg border border-success/40 bg-success-soft p-4 text-[15px]">
        <p className="font-semibold text-success">{state.smsSent ? "Added. Login sent by SMS." : "Added."}</p>
        <p className="mt-1">They sign in as <b className="font-mono">{state.loginAs}</b> with the
          one-time password <b className="font-mono">{state.password}</b> — it shows only this once.
          They should change it under My Account.</p>
      </div>
    );

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name"><input name="name" required className={inputCls} /></Field>
        <Field label="Phone (the login is sent here by SMS)">
          <input name="phone" type="tel" inputMode="tel" className={inputCls} /></Field>
      </div>
      <AccessPicker />
      {state && "error" in state && <p className="text-[15px] text-danger">{state.error}</p>}
      <button disabled={pending} className={btnCls + " h-11 px-6 text-[15px]"}>
        {pending ? "Adding…" : "Add"}
      </button>
    </form>
  );
}
