"use client";
import { useTransition } from "react";
import { startUpgrade } from "@/app/signup/actions";
import { btnCls } from "@/ui/kit";

export function UpgradeButton({ schoolId, planKey, email }: {
  schoolId: string; planKey: string; email: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} className={btnCls + " w-full"}
      onClick={() => start(async () => {
        const r = await startUpgrade(schoolId, planKey, email);
        if (r && "checkoutUrl" in r && r.checkoutUrl) window.location.href = r.checkoutUrl;
      })}>
      {pending ? "…" : "Upgrade"}
    </button>
  );
}
