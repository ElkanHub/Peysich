"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { loadAccounts, rememberAccount, forgetAccount, type DeviceAccount } from "@/lib/device-accounts";
import { LogoLockup } from "@/ui/logo";
import { Field, inputCls, btnCls } from "@/ui/kit";

/** Split-panel sign-in: brand statement left, focused form right. Accounts
 *  used on this device are remembered (name + identifier only, never the
 *  password) so switching — say teacher account ↔ parent account — is two
 *  taps instead of typing. */
export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [accounts, setAccounts] = useState<DeviceAccount[]>([]);
  const [switching, setSwitching] = useState(false);
  const passRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAccounts(loadAccounts());
    setSwitching(new URLSearchParams(window.location.search).has("switch"));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true); setError("");
    const r = email.includes("@")
      ? await authClient.signIn.email({ email, password, callbackURL: "/go" })
      : await authClient.signIn.username({ username: email, password });
    if (r.error) { setPending(false); setError(r.error.message ?? "Sign-in failed"); return; }
    const u = (r.data as { user?: { name?: string } } | null)?.user;
    rememberAccount({ id: email.trim(), name: u?.name });
    if (!email.includes("@")) window.location.href = "/go";
  }

  function pick(a: DeviceAccount) {
    setEmail(a.id); setError("");
    passRef.current?.focus();
  }

  return (
    <main className="light-scope flex min-h-screen bg-background text-foreground">
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
          <h2 className="text-[22px] font-semibold tracking-tight">
            {switching ? "Switch account" : "Welcome back"}
          </h2>
          <p className="mt-1 text-[14px] text-muted-foreground">
            {switching
              ? "Pick an account below, or sign in with another one."
              : "Sign in to your school workspace."}
          </p>
          {error && (
            <p className="mt-4 rounded-md bg-danger-soft px-3 py-2 text-[14px] text-danger">{error}</p>
          )}

          {accounts.length > 0 && (
            <div className="mt-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                On this device
              </p>
              <div className="mt-2 space-y-1.5">
                {accounts.map((a) => (
                  <div key={a.id} className="group flex items-center gap-1.5">
                    <button type="button" onClick={() => pick(a)}
                      className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-md border px-3 py-2 text-left transition-colors ${
                        email === a.id ? "border-primary/50 bg-brand-soft" : "border-border hover:bg-muted"}`}>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[12px] font-semibold uppercase text-primary">
                        {(a.name || a.id).slice(0, 2)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-medium">{a.name || a.id}</span>
                        {a.name && <span className="block truncate text-[12px] text-muted-foreground">{a.id}</span>}
                      </span>
                    </button>
                    <button type="button" aria-label={`Forget ${a.id} on this device`}
                      onClick={() => { forgetAccount(a.id); setAccounts(loadAccounts()); }}
                      className="rounded p-1 text-muted-foreground transition-colors hover:text-danger sm:opacity-0 sm:group-hover:opacity-100">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-[12px] text-muted-foreground">
                Tap an account, then enter its password — passwords are never stored.
              </p>
            </div>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="Email or username">
              <input value={email} onChange={(e) => setEmail(e.target.value)} required
                autoComplete="username" className={inputCls} />
            </Field>
            <Field label="Password">
              <input ref={passRef} value={password} onChange={(e) => setPassword(e.target.value)} type="password"
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
