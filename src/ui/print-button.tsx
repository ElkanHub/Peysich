"use client";
import { Printer } from "lucide-react";
import { btnGhostCls } from "@/ui/kit";

/** Print the current page — the paper routes carry print CSS already. */
export function PrintButton({ label = "Print", className }: { label?: string; className?: string }) {
  return (
    <button type="button" onClick={() => window.print()}
      className={(className ?? btnGhostCls) + " inline-flex items-center gap-1.5 print:hidden"}>
      <Printer size={14} /> {label}
    </button>
  );
}
