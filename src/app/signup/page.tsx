"use client";
import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { createMySchool } from "./actions";
import { Door, doorInputCls, doorBtnCls } from "@/ui/door";
import { cn } from "@/lib/utils";

const label = "block font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground";
const STEPS = ["Your account", "Your school", "Ready"];
const PLANS = [
  { key: "trial", name: "Free trial", sub: "14 days · up to 50 students · no card", price: "GHS 0" },
  { key: "starter", name: "Starter", sub: "Up to 200 students", price: "GHS 99/mo" },
  { key: "standard", name: "Standard", sub: "Up to 600 students · fees & timetable", price: "GHS 249/mo" },
  { key: "premium", name: "Premium", sub: "Unlimited · every module", price: "GHS 499/mo" },
];

/** Self-serve funnel: account → school → plan → trial or pay. */
export default function Signup() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [plan, setPlan] = useState("trial");
  const [done, setDone] = useState<{ slug: string } | null>(null);

  async function createAccount(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setPending(true); setError("");
    const f = new FormData(e.currentTarget);
    const { error } = await authClient.signUp.email({
      name: String(f.get("name")), email: String(f.get("email")), password: String(f.get("password")),
    });
    setPending(false);
    if (error) return setError(error.message ?? "That didn't go through — try again.");
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
  const bareHost = host.replace(/^www\./, "");

  return (
    <Door
      side={{
        title: "Your school, running by tomorrow morning.",
        body: "Create the account, name the school, and pick a plan — the classes, subjects and a free trial are set up for you. Import students from a spreadsheet and mark your first register in the morning.",
      }}
      footer={<p>Already set up? <a href="/sign-in" className="font-semibold text-primary hover:underline">Sign in</a></p>}
    >
      <ol className="flex items-center gap-2 text-[12.5px] font-medium">
        {STEPS.map((s, i) => {
          const n = i + 1, state = n < step ? "done" : n === step ? "now" : "next";
          return (
            <li key={s} className="flex items-center gap-2">
              <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold",
                state === "done" ? "bg-success text-white" : state === "now" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                {state === "done" ? <Check size={12} /> : n}
              </span>
              <span className={state === "next" ? "text-muted-foreground" : ""}>{s}</span>
              {i < STEPS.length - 1 && <span className="mx-1 h-px w-5 bg-border" />}
            </li>
          );
        })}
      </ol>

      {error && <p role="alert" className="mt-5 rounded-xl bg-danger-soft px-3.5 py-2.5 text-[14px] text-danger">{error}</p>}

      {step === 1 && (
        <form onSubmit={createAccount} className="mt-6 space-y-4">
          <div>
            <h2 className="text-[26px] font-semibold leading-tight tracking-tight">Create your account</h2>
            <p className="mt-1.5 text-[15px] text-muted-foreground">You&apos;ll be the school&apos;s main admin.</p>
          </div>
          <div><label className={label} htmlFor="name">Your name</label>
            <input id="name" name="name" required autoComplete="name" className={cn(doorInputCls, "mt-1.5")} /></div>
          <div><label className={label} htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" inputMode="email" className={cn(doorInputCls, "mt-1.5")} /></div>
          <div><label className={label} htmlFor="password">Password</label>
            <input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" className={cn(doorInputCls, "mt-1.5")} />
            <p className="mt-1.5 text-[12.5px] text-muted-foreground">At least 8 characters.</p></div>
          <button disabled={pending} className={doorBtnCls}>{pending ? "Creating…" : <>Continue <ArrowRight size={16} /></>}</button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={createSchool} className="mt-6 space-y-4">
          <div>
            <h2 className="text-[26px] font-semibold leading-tight tracking-tight">Name your school</h2>
            <p className="mt-1.5 text-[15px] text-muted-foreground">This is how it appears on every paper you print.</p>
          </div>
          <div><label className={label} htmlFor="school">School name</label>
            <input id="school" name="name" required className={cn(doorInputCls, "mt-1.5")} placeholder="St. Mary's Basic School" /></div>
          <div>
            <label className={label} htmlFor="slug">Your address</label>
            <div className="mt-1.5 flex items-center gap-2">
              <input id="slug" name="slug" required pattern="[a-z0-9-]+" autoCapitalize="none"
                className={cn(doorInputCls, "min-w-0 flex-1")} placeholder="stmarys" />
              <span className="shrink-0 text-[13px] text-muted-foreground">.{bareHost}</span>
            </div>
            <p className="mt-1.5 text-[12.5px] text-muted-foreground">Lowercase letters, numbers and dashes.</p>
          </div>
          <div>
            <p className={label}>Plan</p>
            <div className="mt-1.5 grid gap-2">
              {PLANS.map((p) => (
                <label key={p.key} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-colors",
                  plan === p.key ? "border-primary bg-brand-soft" : "border-border bg-card hover:bg-muted")}>
                  <input type="radio" name="planKey" value={p.key} checked={plan === p.key} onChange={() => setPlan(p.key)} className="accent-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-semibold">{p.name}</span>
                    <span className="block text-[12.5px] text-muted-foreground">{p.sub}</span>
                  </span>
                  <span className="text-[13px] font-semibold" data-nums="">{p.price}</span>
                </label>
              ))}
            </div>
          </div>
          <button disabled={pending} className={doorBtnCls}>{pending ? "Setting up…" : <>Create my school <ArrowRight size={16} /></>}</button>
        </form>
      )}

      {step === 3 && done && (
        <div className="mt-6">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success-soft text-success"><Check size={24} /></span>
          <h2 className="mt-4 text-[26px] font-semibold leading-tight tracking-tight">Your school is ready.</h2>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            Classes and subjects are in place. Sign in there with the account you just created — the walkthrough will show you around.
          </p>
          {host.endsWith("vercel.app") || host.includes("localhost") ? (
            <a className={cn(doorBtnCls, "mt-6")} href={`/t/${done.slug}`}>Open your school <ArrowRight size={16} /></a>
          ) : (
            <a className={cn(doorBtnCls, "mt-6")} href={`${window.location.protocol}//${done.slug}.${host}`}>
              Open {done.slug}.{bareHost} <ArrowRight size={16} />
            </a>
          )}
        </div>
      )}
    </Door>
  );
}
