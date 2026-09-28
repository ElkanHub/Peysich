"use client";
import { useState, useTransition } from "react";
import { issueStaffLogin } from "./staff-actions";

/** "Create login" on the Staff File. Goes through staff-actions so a bursar
 *  gets the LIMITED bursar grant, never a full admin. Credentials show once. */
export function StaffLoginButton({ slug, id }: { slug: string; id: string }) {
  const [res, setRes] = useState<Awaited<ReturnType<typeof issueStaffLogin>> | null>(null);
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
        onClick={() => start(async () => setRes(await issueStaffLogin(slug, id)))}
        className="rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50">
        {pending ? "…" : "Create login"}
      </button>
      {res && "error" in res && <span className="ml-1 text-xs text-danger">{res.error}</span>}
    </span>
  );
}
