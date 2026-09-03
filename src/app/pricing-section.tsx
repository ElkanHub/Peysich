"use client";
import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";

/* Marketing pricing cards — the data arrives from the server (cached under
 * the "plans" tag, so the page stays static and still updates the moment
 * the platform console saves a plan). Only the monthly/yearly flip and the
 * curated taglines live here. */

const TAGLINES: Record<string, string> = {
  starter: "The office essentials, digital at last",
  standard: "The whole school day, connected",
  premium: "Every department on one platform",
};

export type PublicPlan = {
  key: string; name: string;
  pricePerMonthPesewas: number; pricePerYearPesewas: number;
  studentCap: number | null; moduleKeys: string[];
};

export function PricingCards({ plans, moduleLabels, gradText, gradPanel }: {
  plans: PublicPlan[]; moduleLabels: Record<string, string>;
  gradText: string; gradPanel: string;
}) {
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const paid = plans.filter((p) => p.pricePerMonthPesewas > 0);

  return (
    <>
      <div className="mb-8 flex items-center justify-center gap-3">
        <div className="inline-flex rounded-full border border-border bg-card p-1">
          {(["monthly", "yearly"] as const).map((c) => (
            <button key={c} type="button" onClick={() => setCycle(c)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                cycle === c ? "text-white " + gradPanel : "text-muted-foreground hover:text-foreground"}`}>
              {c}
            </button>
          ))}
        </div>
        <span className={`text-[13px] font-semibold ${cycle === "yearly" ? "text-success" : "text-muted-foreground"}`}>
          2 months free yearly
        </span>
      </div>
      <div className="grid items-stretch gap-5 md:grid-cols-3">
        {paid.map((p, i) => {
          const popular = p.key === "standard" || (paid.length === 3 && i === 1 && !paid.some((x) => x.key === "standard"));
          const prev = i > 0 ? paid[i - 1] : null;
          const delta = prev ? p.moduleKeys.filter((k) => !prev.moduleKeys.includes(k)) : p.moduleKeys;
          const price = cycle === "yearly" ? p.pricePerYearPesewas : p.pricePerMonthPesewas;
          return (
            <div key={p.key}
              className={`relative flex flex-col rounded-2xl p-[1.5px] ${popular ? gradPanel + " shadow-[var(--shadow-lg)]" : ""}`}>
              <div className={`flex h-full flex-col rounded-[15px] bg-card p-6 ${popular ? "" : "border border-border shadow-[var(--shadow-sm)]"}`}>
                {popular && (
                  <span className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11.5px] font-semibold text-white shadow-[var(--shadow-md)] ${gradPanel}`}>
                    Most popular
                  </span>
                )}
                <p className="font-semibold">{p.name}</p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">{TAGLINES[p.key] ?? "Made for your school"}</p>
                <p className="mt-4 text-[34px] font-semibold tracking-tight" data-nums="">
                  <span className={popular ? gradText : ""}>GHS {(price / 100).toLocaleString()}</span>
                  <span className="text-[14px] font-normal text-muted-foreground">/{cycle === "yearly" ? "year" : "month"}</span>
                </p>
                <ul className="mt-5 flex-1 space-y-2.5">
                  <li className="flex items-start gap-2 text-[13.5px] leading-snug">
                    <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                      <Check size={11} strokeWidth={3} />
                    </span>
                    {p.studentCap ? `Up to ${p.studentCap.toLocaleString()} students` : "Unlimited students"}
                  </li>
                  {prev && (
                    <li className="flex items-start gap-2 text-[13.5px] font-medium leading-snug">
                      <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                        <Check size={11} strokeWidth={3} />
                      </span>
                      Everything in {prev.name}
                    </li>
                  )}
                  {delta.map((k) => (
                    <li key={k} className="flex items-start gap-2 text-[13.5px] leading-snug">
                      <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                        <Check size={11} strokeWidth={3} />
                      </span>
                      {moduleLabels[k] ?? k}
                    </li>
                  ))}
                </ul>
                <Link href="/signup"
                  className={`mt-6 block rounded-lg py-2.5 text-center text-sm font-semibold transition-all ${
                    popular
                      ? "text-white shadow-[var(--shadow-md)] hover:scale-[1.01] " + gradPanel
                      : "border border-border hover:bg-muted"}`}>
                  Get started
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
