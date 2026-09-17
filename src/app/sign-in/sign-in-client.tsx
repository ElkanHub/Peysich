"use client";
import { useRef, useState } from "react";
import { Eye, EyeOff, X, ArrowRight } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useDeviceAccounts, rememberAccount, forgetAccount, type DeviceAccount } from "@/lib/device-accounts";
import { useClientValue } from "@/pwa/client";
import { Door, doorInputCls, doorBtnCls, doorGhostCls } from "@/ui/door";
import { cn } from "@/lib/utils";

const label = "block font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground";

/** Sign-in. Accounts used on this device are remembered (name + identifier,
 *  never the password) so a teacher who is also a parent switches in two
 *  taps. Email OR school-issued username — the same box takes both. */
export function SignInClient({ google }: { google: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const accounts = useDeviceAccounts();
  const switching = useClientValue(() => new URLSearchParams(window.location.search).has("switch"), false);
  const passRef = useRef<HTMLInputElement>(null);
  const idRef = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!navigator.onLine) { setError("You're offline. Signing in needs a connection — try again when you have one."); return; }
    setPending(true); setError("");
    const id = email.trim();
    const r = id.includes("@")
      ? await authClient.signIn.email({ email: id, password, callbackURL: "/go" })
      : await authClient.signIn.username({ username: id, password });
    if (r.error) {
      setPending(false);
      setError(r.error.status === 401 || /invalid|incorrect|not found/i.test(r.error.message ?? "")
        ? "That password doesn't match this account. Check it and try again."
        : r.error.message ?? "Sign-in didn't go through. Try again.");
      return;
    }
    const u = (r.data as { user?: { name?: string } } | null)?.user;
    rememberAccount({ id, name: u?.name });
    if (!id.includes("@")) window.location.href = "/go";
  }

  const pick = (a: DeviceAccount) => { setEmail(a.id); setError(""); passRef.current?.focus(); };
  const picked = accounts.find((a) => a.id.toLowerCase() === email.trim().toLowerCase());

  return (
    <Door
      side={{
        title: "Run the whole school from one calm place.",
        body: "Attendance in 30 seconds. Report cards in one click. Fees parents can actually pay — with the papers signed, stamped and ready. Built for preschool through JHS.",
      }}
      footer={<p>Trouble signing in? Your school office can reset your login — passwords are never sent by SchoolSpec.</p>}
    >
      <h2 className="text-[26px] font-semibold leading-tight tracking-tight">
        {switching ? "Switch account" : "Welcome back"}
      </h2>
      <p className="mt-1.5 text-[15px] text-muted-foreground">
        {switching ? "Pick an account below, or sign in with another one." : "Sign in to your school."}
      </p>

      {accounts.length > 0 && (
        <div className="mt-6">
          <p className={label}>On this device</p>
          <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
            {accounts.map((a) => {
              const on = picked?.id === a.id;
              return (
                <div key={a.id} className="group relative shrink-0">
                  <button type="button" onClick={() => pick(a)}
                    className={cn("flex w-[132px] flex-col items-start gap-2 rounded-2xl border p-3 text-left transition-colors",
                      on ? "border-primary bg-brand-soft" : "border-border bg-card hover:bg-muted")}>
                    <span className={cn("flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-semibold uppercase",
                      on ? "bg-primary text-primary-foreground" : "bg-brand-container text-on-brand-container")}>
                      {(a.name || a.id).slice(0, 2)}
                    </span>
                    <span className="min-w-0 w-full">
                      <span className="block truncate text-[14px] font-medium">{a.name || a.id}</span>
                      <span className="block truncate text-[11.5px] text-muted-foreground">{a.name ? a.id : "tap to continue"}</span>
                    </span>
                  </button>
                  <button type="button" aria-label={`Forget ${a.id} on this device`}
                    onClick={() => { forgetAccount(a.id); if (email === a.id) setEmail(""); }}
                    className="absolute -right-1.5 -top-1.5 rounded-full border border-border bg-card p-1 text-muted-foreground shadow-[var(--shadow-sm)] transition-colors hover:text-danger sm:opacity-0 sm:group-hover:opacity-100">
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="id" className={label}>Email or username</label>
          <input id="id" ref={idRef} value={email} onChange={(e) => setEmail(e.target.value)} required
            autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
            inputMode="email" className={cn(doorInputCls, "mt-1.5")} placeholder="you@school.edu.gh or your username" />
        </div>
        <div>
          <label htmlFor="pw" className={label}>Password</label>
          <div className="relative mt-1.5">
            <input id="pw" ref={passRef} value={password} onChange={(e) => setPassword(e.target.value)}
              type={show ? "text" : "password"} required autoComplete="current-password"
              className={cn(doorInputCls, "pr-12")} placeholder="••••••••" />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
              {show ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>
        {error && (
          <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-[14px] text-danger">{error}</p>
        )}
        <button type="submit" disabled={pending} className={doorBtnCls}>
          {pending ? "Signing in…" : <>Sign in <ArrowRight size={16} /></>}
        </button>
      </form>

      {google && (
        <>
          <div className="my-5 flex items-center gap-3 text-[12px] text-faint">
            <span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" />
          </div>
          <button type="button" className={doorGhostCls}
            onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/go" })}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
              <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.6 2.3 2.3 6.6 2.3 12s4.3 9.7 9.7 9.7c5.6 0 9.3-3.9 9.3-9.5 0-.6-.1-1.1-.2-1.6H12z" />
            </svg>
            Continue with Google
          </button>
        </>
      )}

      <p className="mt-8 text-[14px] text-muted-foreground">
        New school? <a href="/signup" className="font-semibold text-primary hover:underline">Start a free trial</a>
      </p>
    </Door>
  );
}
