"use client";
import { useActionState } from "react";
import { invitePlatformAdmin } from "../actions";
import { Field, btnCls, inputCls } from "@/ui/kit";

export function InviteAdmin() {
  const [state, action, pending] = useActionState(invitePlatformAdmin, null);
  if (state && "loginAs" in state!)
    return (
      <p className="rounded-md bg-success-soft px-3 py-2 font-mono text-[13px] text-success">
        Invited: {state.loginAs} / {state.password} — share once, they change it on first login.
      </p>
    );
  return (
    <form action={action} className="flex items-end gap-2">
      <Field label="Name"><input name="name" required className={inputCls} /></Field>
      <Field label="Email"><input name="email" type="email" required className={inputCls} /></Field>
      <button disabled={pending} className={btnCls}>{pending ? "…" : "Invite platform admin"}</button>
      {state && "error" in state! && <span className="text-sm text-danger">{state.error}</span>}
    </form>
  );
}
