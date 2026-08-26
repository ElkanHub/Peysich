"use client";
import { useActionState } from "react";
import { addTeamMember, type AddMemberResult } from "./team-actions";
import { ACCESS_PRESETS, TAB_KEYS, FEE_ACTION_LABELS } from "@/core/access-const";
import { Field, inputCls, btnCls } from "@/ui/kit";

/** Add a team member — shows the issued login + one-time password once. */
export function AddTeamMember({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(
    async (_prev: AddMemberResult | null, f: FormData) => addTeamMember(slug, f), null);

  if (state && "loginAs" in state)
    return (
      <div className="rounded-lg border border-success/40 bg-success-soft p-4 text-sm">
        <p className="font-semibold text-success">Member added ✓</p>
        <p className="mt-1">They sign in as <b className="font-mono">{state.loginAs}</b> with the
          one-time password <b className="font-mono">{state.password}</b> — share it privately;
          it shows only this once. They should change it under My Account.</p>
      </div>
    );

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Full name"><input name="name" required className={inputCls} /></Field>
        <Field label="Email (optional — a username is issued without one)">
          <input name="email" type="email" className={inputCls} /></Field>
      </div>
      <Field label="Start from">
        <select name="preset" className={inputCls} defaultValue="cashier">
          {Object.entries(ACCESS_PRESETS).map(([k, p]) => (
            <option key={k} value={k}>{p.label} — {p.tabs.map((t) =>
              TAB_KEYS.find((x) => x.key === t)?.label ?? t).join(", ")}</option>
          ))}
          <option value="">Custom (tick sections below)</option>
        </select>
      </Field>
      <details className="rounded-md border border-border px-3 py-2">
        <summary className="cursor-pointer text-[13px] font-medium text-muted-foreground">
          Custom sections &amp; money actions (used when &quot;Custom&quot; is chosen)
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {TAB_KEYS.map((t) => (
            <label key={t.key} className="flex items-center gap-1.5 text-[13px]">
              <input type="checkbox" name={`tab_${t.key}`} /> {t.label}
            </label>
          ))}
        </div>
        <p className="mt-3 mb-1 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Money actions</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {Object.entries(FEE_ACTION_LABELS).map(([k, l]) => (
            <label key={k} className="flex items-center gap-1.5 text-[13px]">
              <input type="checkbox" name={`fee_${k}`} /> {l}
            </label>
          ))}
        </div>
      </details>
      {state && "error" in state && <p className="text-sm text-danger">{state.error}</p>}
      <button disabled={pending} className={btnCls}>
        {pending ? "Adding…" : "Add member & issue login"}
      </button>
    </form>
  );
}
