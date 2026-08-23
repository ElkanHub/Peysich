"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { LogoLockup } from "@/ui/logo";
import { Field, inputCls, btnCls } from "@/ui/kit";

/** Split-panel sign-in: brand statement left, focused form right. */
export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true); setError("");
    const { error } = email.includes("@")
      ? await authClient.signIn.email({ email, password, callbackURL: "/go" })
      : await authClient.signIn.username({ username: email, password });
    setPending(false);
    if (error) setError(error.message ?? "Sign-in failed");
    else if (!email.includes("@")) window.location.href = "/go";
  }

  return (
    <main className="flex min-h-screen">
      {/* brand panel */}
      <div className="relative hidden w-[44%] flex-col justify-between overflow-hidden bg-ink p-10 lg:flex">
        <div aria-hidden className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div aria-hidden className="absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <LogoLockup size={30} dark />
        <div className="relative">
          <h1 className="max-w-sm text-[28px] font-semibold leading-snug tracking-tight text-ink-text-strong">
            Run your whole school from one calm place.
          </h1>
          <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-ink-text/80">
            Attendance in 30 seconds. Report cards in one click. Fees parents can
            actually pay. Built for preschool through JHS.
          </p>
        </div>
        <p className="relative text-[13px] text-ink-text/50">© {new Date().getFullYear()} Peysich</p>
      </div>

      {/* form panel */}
      <div className="flex flex-1 items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><LogoLockup size={28} /></div>
          <h2 className="text-[22px] font-semibold tracking-tight">Welcome back</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">Sign in to your school workspace.</p>
          {error && (
            <p className="mt-4 rounded-md bg-danger-soft px-3 py-2 text-[14px] text-danger">{error}</p>
          )}
          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="Email or username">
              <input value={email} onChange={(e) => setEmail(e.target.value)} required
                autoComplete="username" className={inputCls} />
            </Field>
            <Field label="Password">
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password"
                required autoComplete="current-password" className={inputCls} />
            </Field>
            <button type="submit" disabled={pending} className={btnCls + " w-full"}>
              {pending ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <p className="mt-6 text-[14px] text-muted-foreground">
            New school? <a href="/signup" className="font-medium text-primary hover:underline">Start a free trial</a>
          </p>
        </div>
      </div>
    </main>
  );
}
