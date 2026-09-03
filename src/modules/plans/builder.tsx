"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { Check, Lock, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { btnCls, inputCls } from "@/ui/kit";

/* ── Custom plan builder ────────────────────────────────────────────────────
   One component, two homes: the school's Billing page (mode "app" — we know
   who they are) and the public marketing page (mode "public" — a small lead
   form rides along). The estimate mirrors core/plan-const.ts exactly; the
   server recomputes it anyway, so the number we call about is the number
   they saw. It is a starting point, never a bill.                          */

type Band = { key: string; label: string; addPesewas: number };
type Result = { ok?: boolean; error?: string };

export function PlanBuilder({ mode, coreLabels, addons, bands, basePesewas, defaultPhone, action }: {
  mode: "app" | "public";
  coreLabels: string[];
  addons: { key: string; label: string; pricePesewas: number }[];
  bands: Band[];
  basePesewas: number;
  defaultPhone?: string;
  action: (payload: {
    moduleKeys: string[]; sizeBand: string;
    name?: string; schoolName?: string; phone?: string; hp?: string;
  }) => Promise<Result>;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [band, setBand] = useState(bands[0].key);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const nameRef = useRef<HTMLInputElement>(null);
  const schoolRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const hpRef = useRef<HTMLInputElement>(null);

  const estimate = useMemo(() => {
    const b = bands.find((x) => x.key === band);
    return basePesewas + (b?.addPesewas ?? 0)
      + picked.reduce((s, k) => s + (addons.find((a) => a.key === k)?.pricePesewas ?? 0), 0);
  }, [picked, band, bands, addons, basePesewas]);

  const toggle = (k: string) =>
    setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const submit = () => start(async () => {
    setError(null);
    const payload = {
      moduleKeys: picked, sizeBand: band,
      phone: phoneRef.current?.value ?? "",
      ...(mode === "public" ? {
        name: nameRef.current?.value ?? "",
        schoolName: schoolRef.current?.value ?? "",
        hp: hpRef.current?.value ?? "",
      } : {}),
    };
    const r = await action(payload);
    if (r?.error) setError(r.error);
    else setSent(true);
  });

  if (sent) {
    return (
      <div className="rounded-2xl bg-success-soft p-6 text-center" data-tour="builder">
        <Phone size={22} className="mx-auto text-success" />
        <p className="mt-2 font-semibold text-success">Request received.</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Someone from Peysich will call {mode === "public" ? "the number you gave" : "your school's number"} within
          one working day to talk it through and agree a final price. Nothing changes on your account until then.
        </p>
      </div>
    );
  }

  const chip = (on: boolean) => cn(
    "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13.5px] font-medium transition-colors",
    on ? "bg-brand-container text-on-brand-container" : "bg-muted text-muted-foreground hover:text-foreground",
  );

  return (
    <div className="grid gap-5 md:grid-cols-[1fr_240px]" data-tour="builder">
      <div>
        <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Always included</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {coreLabels.map((l) => (
            <span key={l} className="inline-flex items-center gap-1.5 rounded-full bg-brand-container px-3.5 py-2 text-[13.5px] font-medium text-on-brand-container">
              <Lock size={12} /> {l}
            </span>
          ))}
        </div>
        <p className="mt-5 font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Pick your add-ons</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {addons.map((a) => {
            const on = picked.includes(a.key);
            return (
              <button key={a.key} type="button" onClick={() => toggle(a.key)} aria-pressed={on} className={chip(on)}>
                {on && <Check size={13} />} {a.label}
                <span className={cn("text-[11.5px]", on ? "opacity-70" : "opacity-60")}>
                  +{(a.pricePesewas / 100).toFixed(0)}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-5 font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">How many students?</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {bands.map((b) => (
            <button key={b.key} type="button" onClick={() => setBand(b.key)} aria-pressed={band === b.key} className={chip(band === b.key)}>
              {b.label}
            </button>
          ))}
        </div>
        {mode === "app" && (
          <div className="mt-5 max-w-xs">
            <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              The number we should call
            </p>
            <input ref={phoneRef} defaultValue={defaultPhone ?? ""} className={cn(inputCls, "mt-2")}
              placeholder="Phone number" autoComplete="tel" inputMode="tel" />
          </div>
        )}
        {mode === "public" && (
          <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
            <input ref={nameRef} className={inputCls} placeholder="Your name" autoComplete="name" />
            <input ref={schoolRef} className={inputCls} placeholder="School name" autoComplete="organization" />
            <input ref={phoneRef} className={inputCls} placeholder="Phone number" autoComplete="tel" inputMode="tel" />
            <input ref={hpRef} name="website" tabIndex={-1} autoComplete="off" aria-hidden="true"
              className="absolute -left-[9999px] h-0 w-0 opacity-0" />
          </div>
        )}
      </div>

      <div className="h-fit rounded-2xl bg-muted p-5 md:sticky md:top-20">
        <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Estimated from</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight">
          GHS {(estimate / 100).toLocaleString()}
          <span className="text-sm font-normal text-muted-foreground">/month</span>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          or GHS {((estimate * 10) / 100).toLocaleString()}/year — 2 months free
        </p>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          This is a starting point, not a bill. We&apos;ll call, talk it through, and agree the final price together.
        </p>
        <button type="button" onClick={submit} disabled={pending} className={cn(btnCls, "mt-4 w-full")}>
          {pending ? "Sending…" : "Request this plan"}
        </button>
        {error && <p className="mt-2 text-xs font-medium text-danger">{error}</p>}
      </div>
    </div>
  );
}
