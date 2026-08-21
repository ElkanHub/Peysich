"use client";
import { use, useState } from "react";
import { authClient, useSession } from "@/lib/auth-client";
import { Card, Field, PageHeader, inputCls, btnCls } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";

/** My Account (every role): profile + password change (doc 06 settings spec). */
export default function Account({ params }: { params: Promise<{ school: string }> }) {
  use(params);
  const { data: session } = useSession();
  const [name, setName] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const u = session?.user as { name: string; email: string } | undefined;

  return (
    <div className="max-w-md space-y-5">
      <PageHeader title="My Account" />
      <Card>
        <h2 className="font-semibold">Profile</h2>
        <form className="mt-3 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const { error } = await authClient.updateUser({ name: name ?? u?.name ?? "" });
            setMsg(error ? error.message ?? "Failed" : "Saved ✓");
          }}>
          <Field label="Full name">
            <input value={name ?? u?.name ?? ""} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Email / login">
            <input value={u?.email ?? ""} disabled className={inputCls + " opacity-60"} />
          </Field>
          <SubmitButton className={btnCls}>Save</SubmitButton>
          {msg && <span className="ml-2 text-sm text-success">{msg}</span>}
        </form>
      </Card>
      <Card>
        <h2 className="font-semibold">Change password</h2>
        <form className="mt-3 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const { error } = await authClient.changePassword({
              currentPassword: String(f.get("current")),
              newPassword: String(f.get("next")),
              revokeOtherSessions: true,
            });
            setPwMsg(error ? error.message ?? "Failed" : "Password changed ✓ (other sessions signed out)");
          }}>
          <Field label="Current password"><input name="current" type="password" required className={inputCls} /></Field>
          <Field label="New password (min 8)"><input name="next" type="password" minLength={8} required className={inputCls} /></Field>
          <SubmitButton className={btnCls}>Change password</SubmitButton>
          {pwMsg && <p className="text-sm text-success">{pwMsg}</p>}
        </form>
      </Card>
    </div>
  );
}
