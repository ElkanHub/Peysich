"use client";
import { useActionState } from "react";
import { createSchool } from "../../actions";

export default function NewSchool() {
  const [state, action, pending] = useActionState(createSchool, null);
  return (
    <form action={action} className="max-w-sm">
      <h1 className="text-2xl font-semibold">New school</h1>
      {state?.error && <p className="mt-2 text-sm text-danger">{state.error}</p>}
      <label className="mt-4 block text-xs text-muted-foreground">School name</label>
      <input name="name" required className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm" />
      <label className="mt-3 block text-xs text-muted-foreground">Slug (subdomain)</label>
      <input name="slug" required pattern="[a-z0-9-]+" className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm" />
      <label className="mt-3 block text-xs text-muted-foreground">Plan</label>
      <select name="planKey" defaultValue="trial" className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm">
        <option value="trial">Trial</option>
        <option value="starter">Starter</option>
        <option value="standard">Standard</option>
        <option value="premium">Premium</option>
      </select>
      <button disabled={pending}
        className="mt-4 w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
        {pending ? "Creating…" : "Create school"}
      </button>
    </form>
  );
}
