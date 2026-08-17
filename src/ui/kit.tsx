import Link from "next/link";
import { cn } from "@/lib/utils";

/* Peysich UI kit — morphed shadcn-style primitives (doc 06). */

export const inputCls =
  "w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40";
export const btnCls =
  "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60";
export const btnGhostCls =
  "inline-flex items-center justify-center rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

/** Page header: title left, ONE primary action top-right. Always. (doc 06 law #1) */
export function PageHeader({ title, sub, action }: {
  title: string; sub?: string; action?: { href: string; label: string } | React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {sub && <p className="mt-0.5 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {action != null && typeof action === "object" && "href" in action
        ? <Link href={action.href} className={btnCls}>{action.label}</Link>
        : (action as React.ReactNode)}
    </div>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-lg border border-border bg-card p-5 shadow-sm", className)}>{children}</div>;
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-10 text-center">
      <p className="font-medium">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Data table: fixed row height, actions in LAST column always (doc 06 law #2). */
export function DataTable({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            {head.map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export function Tr({ children }: { children: React.ReactNode }) {
  return <tr className="h-12 border-b border-border last:border-0 hover:bg-muted/40">{children}</tr>;
}
export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-2", className)}>{children}</td>;
}
