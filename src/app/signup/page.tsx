"use client";
import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { rememberAccount } from "@/lib/device-accounts";
import { createMySchool } from "./actions";
import { Door, doorInputCls, doorBtnCls } from "@/ui/door";
import { cn } from "@/lib/utils";

const label = "block font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground";
const input = cn(doorInputCls, "mt-1.5 text-[16px]");
const btn = cn(doorBtnCls, "text-[16px]");
const STEPS = ["You", "Your school"];
// ponytail: naive slug guess — the person can always tap "change"
const FILLER = new Set(["the", "of", "and", "school", "basic", "academy", "international", "ltd", "limited"]);
function suggestSlug(name: string) {
  const words = name.toLowerCase().replace(/['’]/g, "").split(/[^a-z0-9]+/).filter(Boolean);
  const kept = words.filter((w) => !FILLER.has(w));
  return (kept.length ? kept : words).join("").slice(0, 40);
}

/** Self-serve funnel: you → your school → straight into the dashboard (free trial). */
export default function Signup() {
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [school, setSchool] = useState("");
  const [slug, setSlug] = useState<string | null>(null); // null = follow the school name
  const [editing, setEditing] = useState(false);

  const host = typeof window !== "undefined" ? window.location.host : "";
  const bareHost = host.replace(/^www\./, "");
  const link = slug ?? suggestSlug(school);

  async function createAccount(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setPending(true); setError("");
    const f = new FormData(e.currentTarget);
    const id = String(f.get("email"));
    const { error } = await authClient.signUp.email({
      name: String(f.get("name")), email: id, password: String(f.get("password")),
    });
    setPending(false);
    if (error) return setError(error.message ?? "That didn't go through — try again.");
    rememberAccount({ id, name: String(f.get("name")) });
    setStep(2);
  }

  async function createSchool(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setPending(true); setError("");
    const f = new FormData(e.currentTarget);
    f.set("slug", link);
    const r = await createMySchool(null, f);
    if (r && "error" in r && r.error) { setPending(false); return setError(r.error); }
    // /go re-reads the session (schoolId just changed) and lands on the dashboard —
    // via the subdomain in production, via the tenant cookie in preview.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- /go is a route handler: it sets cookies and may hop to the school subdomain, so a full navigation is required
    window.location.href = "/go";
  }

  return (
    <Door
      side={{
        title: "Your school, running by tomorrow morning.",
        body: "Create the account and name the school — classes, subjects and a free trial are set up for you. Import students from a spreadsheet and mark your first register in the morning.",
      }}
      footer={<p>Already set up? <a href="/sign-in" className="font-semibold text-primary hover:underline">Sign in</a></p>}
    >
      <ol className="flex items-center gap-2 text-[14px] font-medium">
        {STEPS.map((s, i) => {
          const n = i + 1, state = n < step ? "done" : n === step ? "now" : "next";
          return (
            <li key={s} className="flex items-center gap-2">
              <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold",
                state === "done" ? "bg-success text-white" : state === "now" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                {state === "done" ? <Check size={12} /> : n}
              </span>
              <span className={state === "next" ? "text-muted-foreground" : ""}>{s}</span>
              {i < STEPS.length - 1 && <span className="mx-1 h-px w-5 bg-border" />}
            </li>
          );
        })}
      </ol>

      {error && <p role="alert" className="mt-5 rounded-xl bg-danger-soft px-3.5 py-2.5 text-[15px] text-danger">{error}</p>}

      {step === 1 && (
        <form onSubmit={createAccount} className="mt-6 space-y-4">
          <div>
            <h2 className="text-[26px] font-semibold leading-tight tracking-tight">Create your account</h2>
            <p className="mt-1.5 text-[16px] text-muted-foreground">You&apos;ll be the school&apos;s main admin.</p>
          </div>
          <div><label className={label} htmlFor="name">Your name</label>
            <input id="name" name="name" required autoComplete="name" className={input} /></div>
          <div><label className={label} htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" inputMode="email" className={input} /></div>
          <div><label className={label} htmlFor="password">Password</label>
            <input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" className={input} />
            <p className="mt-1.5 text-[14px] text-muted-foreground">At least 8 characters.</p></div>
          <button disabled={pending} className={btn}>{pending ? "Creating…" : <>Continue <ArrowRight size={16} /></>}</button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={createSchool} className="mt-6 space-y-4">
          <div>
            <h2 className="text-[26px] font-semibold leading-tight tracking-tight">Name your school</h2>
            <p className="mt-1.5 text-[16px] text-muted-foreground">This is how it appears on every paper you print.</p>
          </div>
          <div><label className={label} htmlFor="school">School name</label>
            <input id="school" name="name" required value={school} onChange={(e) => setSchool(e.target.value)}
              className={input} placeholder="St. Mary's Basic School" /></div>
          {editing ? (
            <div>
              <label className={label} htmlFor="slug">Your school&apos;s link</label>
              <div className="mt-1.5 flex items-center gap-2">
                <input id="slug" value={link} onChange={(e) => setSlug(e.target.value.toLowerCase())} autoFocus
                  required pattern="[a-z0-9][a-z0-9-]{0,38}[a-z0-9]" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                  className={cn(doorInputCls, "min-w-0 flex-1 text-[16px]")} placeholder="stmarys" />
                <span className="shrink-0 text-[14px] text-muted-foreground">.{bareHost}</span>
              </div>
              <p className="mt-1.5 text-[14px] text-muted-foreground">Lowercase letters, numbers and dashes.</p>
            </div>
          ) : (
            <p className="text-[16px] text-muted-foreground">
              Your school&apos;s link will be <b className="break-all text-foreground">{link || "…"}.{bareHost}</b>
              {" · "}
              <button type="button" onClick={() => { setSlug(link); setEditing(true); }}
                className="min-h-12 font-semibold text-primary hover:underline">change</button>
            </p>
          )}
          <button disabled={pending || !link} className={btn}>{pending ? "Setting up…" : <>Create my school <ArrowRight size={16} /></>}</button>
          <p className="text-[14px] text-muted-foreground">
            By creating a school you agree to the{" "}
            <a href="/legal/terms" className="underline underline-offset-4" target="_blank" rel="noopener">terms of service</a>,{" "}
            the <a href="/legal/data-processing" className="underline underline-offset-4" target="_blank" rel="noopener">data processing agreement</a>{" "}
            and the <a href="/legal/privacy" className="underline underline-offset-4" target="_blank" rel="noopener">privacy policy</a>.
          </p>
        </form>
      )}
    </Door>
  );
}
