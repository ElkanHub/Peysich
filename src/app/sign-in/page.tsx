"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

/** Minimal sign-in (email/password now; Google button appears when creds exist).
 *  Premium clerk-style card lands with the Phase 1 UI pass. */
export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = email.includes("@")
      ? await authClient.signIn.email({ email, password, callbackURL: "/go" })
      : await authClient.signIn.username({ username: email, password });
    if (error) setError(error.message ?? "Sign-in failed");
    else if (!email.includes("@")) window.location.href = "/go";
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted">
      <form onSubmit={submit} className="w-80 rounded-md bg-card p-6 shadow-sm ring-1 ring-border">
        <h1 className="text-lg font-semibold">Sign in to Peysich</h1>
        {error && <p className="mt-2 text-xs text-danger">{error}</p>}
        <label className="mt-4 block text-xs text-muted-foreground">Email or username</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} required
          className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm" />
        <label className="mt-3 block text-xs text-muted-foreground">Password</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required
          className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm" />
        <button type="submit"
          className="mt-4 w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground">
          Sign in
        </button>
      </form>
    </main>
  );
}
