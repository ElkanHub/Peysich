"use client";
import { useState, useTransition } from "react";
import { issueLogin, resetLogin, type IssueResult } from "@/app/s/[school]/accounts-actions";

/** "Create login" button: shows the generated credentials ONCE, inline. */
export function IssueLoginButton({ slug, kind, id }: {
  slug: string; kind: "staff" | "guardian" | "student"; id: string;
}) {
  const [res, setRes] = useState<IssueResult | null>(null);
  const [pending, start] = useTransition();
  if (res && "loginAs" in res)
    return (
      <span className="rounded bg-success/10 px-2 py-1 font-mono text-xs text-success">
        {res.loginAs} / {res.password}
      </span>
    );
  return (
    <span>
      <button disabled={pending}
        onClick={() => start(async () => setRes(await issueLogin(slug, kind, id)))}
        className="rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50">
        {pending ? "…" : "Create login"}
      </button>
      {res && "error" in res && <span className="ml-1 text-xs text-danger">{res.error}</span>}
    </span>
  );
}

/** "Reset password" for an existing login — the office recovery flow when a
 *  student/teacher/parent misplaces their credentials. Shown once. */
export function ResetPasswordButton({ slug, kind, id }: {
  slug: string; kind: "staff" | "guardian" | "student"; id: string;
}) {
  const [res, setRes] = useState<IssueResult | null>(null);
  const [pending, start] = useTransition();
  if (res && "loginAs" in res)
    return (
      <span className="rounded bg-success/10 px-2 py-1 font-mono text-xs text-success">
        {res.loginAs} / {res.password}
      </span>
    );
  return (
    <span>
      <button disabled={pending}
        onClick={() => start(async () => setRes(await resetLogin(slug, kind, id)))}
        className="rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50">
        {pending ? "…" : "Reset password"}
      </button>
      {res && "error" in res && <span className="ml-1 text-xs text-danger">{res.error}</span>}
    </span>
  );
}
