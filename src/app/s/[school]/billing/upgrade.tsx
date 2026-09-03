"use client";
import { useTransition } from "react";
import { startUpgrade } from "@/app/signup/actions";
import { btnCls } from "@/ui/kit";
import { cn } from "@/lib/utils";

/** One button per card; the page's Monthly/Yearly toggle decides the cycle. */
export function UpgradeButton({ schoolId, planKey, email, cycle }: {
  schoolId: string; planKey: string; email: string; cycle: "monthly" | "yearly";
}) {
  const [pending, start] = useTransition();
  const go = () => start(async () => {
    const r = await startUpgrade(schoolId, planKey, email, cycle);
    if (r && "checkoutUrl" in r && r.checkoutUrl) window.location.href = r.checkoutUrl;
  });
  return (
    <button disabled={pending} className={cn(btnCls, "w-full")} onClick={go}>
      {pending ? "Opening checkout…" : `Switch to this plan (${cycle})`}
    </button>
  );
}
