"use client";
import { useTransition } from "react";
import { startUpgrade } from "@/app/signup/actions";
import { btnCls, btnGhostCls } from "@/ui/kit";

export function UpgradeButton({ schoolId, planKey, email }: {
  schoolId: string; planKey: string; email: string;
}) {
  const [pending, start] = useTransition();
  const go = (cycle: "monthly" | "yearly") => start(async () => {
    const r = await startUpgrade(schoolId, planKey, email, cycle);
    if (r && "checkoutUrl" in r && r.checkoutUrl) window.location.href = r.checkoutUrl;
  });
  return (
    <div className="grid grid-cols-2 gap-2">
      <button disabled={pending} className={btnCls} onClick={() => go("monthly")}>
        {pending ? "…" : "Monthly"}
      </button>
      <button disabled={pending} className={btnGhostCls} onClick={() => go("yearly")}>
        {pending ? "…" : "Yearly"}
      </button>
    </div>
  );
}
