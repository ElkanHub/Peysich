"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { createMySchool } from "./actions";
import { Card, Field, inputCls, btnCls } from "@/ui/kit";

/** Self-serve funnel (doc 04): account → school → plan → pay/trial. */
export default function Signup() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<{ slug: string } | null>(null);

  async function createAccount(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setPending(true); setError("");
    const f = new FormData(e.currentTarget);
    const { error } = await authClient.signUp.email({
      name: String(f.get("name")), email: String(f.get("email")),
      password: String(f.get("password")),
    });
    setPending(false);
    if (error) return setError(error.message ?? "Sign-up failed");
    setStep(2);
  }

  async function createSchool(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setPending(true); setError("");
    const r = await createMySchool(null, new FormData(e.currentTarget));
    setPending(false);
    if (r && "error" in r && r.error) return setError(r.error);
    if (r && "checkoutUrl" in r && r.checkoutUrl) return void (window.location.href = r.checkoutUrl);
    if (r && "slug" in r && r.slug) { setDone({ slug: r.slug }); setStep(3); }
  }

  const host = typeof window !== "undefined" ? window.location.host : "";

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-md">
        <h1 className="text-xl font-semibold">Start with Peysich</h1>
        <p className="mt-1 text-sm text-muted-foreground">Step {step} of 3</p>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}

        {step === 1 && (
          <form onSubmit={createAccount} className="mt-4 space-y-3">
            <Field label="Your name"><input name="name" required className={inputCls} /></Field>
            <Field label="Email"><input name="email" type="email" required className={inputCls} /></Field>
            <Field label="Password"><input name="password" type="password" minLength={8} required className={inputCls} /></Field>
            <button disabled={pending} className={btnCls + " w-full"}>{pending ? "…" : "Create account"}</button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={createSchool} className="mt-4 space-y-3">
            <Field label="School name"><input name="name" required className={inputCls} /></Field>
            <Field label="Subdomain">
              <div className="flex items-center gap-1">
                <input name="slug" required pattern="[a-z0-9-]+" className={inputCls} />
                <span className="text-sm text-muted-foreground">.{host.replace(/^www\./, "")}</span>
              </div>
            </Field>
            <Field label="Plan">
              <select name="planKey" defaultValue="trial" className={inputCls}>
                <option value="trial">Free 14-day trial (50 students)</option>
                <option value="starter">Starter — GHS 375/term</option>
                <option value="standard">Standard — GHS 975/term</option>
                <option value="premium">Premium — GHS 2,000/term</option>
              </select>
            </Field>
            <button disabled={pending} className={btnCls + " w-full"}>{pending ? "…" : "Create my school"}</button>
          </form>
        )}

        {step === 3 && done && (
          <div className="mt-4 text-sm">
            <p className="text-success">🎉 Your school is ready.</p>
            {host.endsWith("vercel.app") ? (
              <a className={btnCls + " mt-3 w-full"} href={`/t/${done.slug}`}>
                Open your school dashboard
              </a>
            ) : (
              <a className={btnCls + " mt-3 w-full"}
                href={`${window.location.protocol}//${done.slug}.${host}`}>
                Open {done.slug}.{host.replace(/^www\./, "")}
              </a>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Sign in there with the account you just created.</p>
          </div>
        )}
      </Card>
    </main>
  );
}
