import Link from "next/link";
import { cn } from "@/lib/utils";

/* Peysich UI kit — the premium pass. Hairline borders, quiet shadows,
   one accent, stable action placement (doc 06 laws). */

export const inputCls =
  "w-full rounded-md border border-border bg-card px-3 py-2 text-sm shadow-[var(--shadow-sm)] outline-none transition-colors placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-ring/25";
export const btnCls =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-[var(--shadow-sm)] transition-all hover:bg-brand-strong active:scale-[.99] disabled:pointer-events-none disabled:opacity-55";
export const btnGhostCls =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3.5 text-sm font-medium shadow-[var(--shadow-sm)] transition-colors hover:border-border-strong hover:bg-muted";
export const btnDangerCls =
  "inline-flex h-9 items-center justify-center rounded-md bg-danger px-4 text-sm font-medium text-white shadow-[var(--shadow-sm)] transition-opacity hover:opacity-90";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

/** Page header: title left, ONE primary action top-right. Always. */
export function PageHeader({ title, sub, action }: {
  title: string; sub?: string; action?: { href: string; label: string } | React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-tight">{title}</h1>
        {sub && <p className="mt-1 text-[13px] text-muted-foreground">{sub}</p>}
      </div>
      {action != null && typeof action === "object" && "href" in action
        ? <Link href={action.href} className={btnCls}>{action.label}</Link>
        : (action as React.ReactNode)}
    </div>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      "rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-sm)] transition-shadow",
      className)}>
      {children}
    </div>
  );
}

/** Stat tile for dashboards. */
export function Stat({ label, value, tone }: {
  label: string; value: React.ReactNode; tone?: "success" | "danger" | "default";
}) {
  return (
    <Card className="hover:shadow-[var(--shadow-md)]">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p data-nums="" className={cn("mt-1.5 text-[26px] font-semibold leading-none tracking-tight",
        tone === "success" && "text-success", tone === "danger" && "text-danger")}>
        {value}
      </p>
    </Card>
  );
}

export function Badge({ children, tone = "default" }: {
  children: React.ReactNode; tone?: "success" | "warning" | "danger" | "default" | "brand";
}) {
  const tones = {
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
    brand: "bg-brand-soft text-primary",
    default: "bg-muted text-muted-foreground",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", tones[tone])}>
      {children}
    </span>
  );
}

export function Empty({ title, hint, action }: {
  title: string; hint?: string; action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border-strong bg-card/60 px-8 py-14 text-center">
      <p className="font-medium">{title}</p>
      {hint && <p className="mx-auto mt-1.5 max-w-sm text-[13px] text-muted-foreground">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/** Data table: sticky uppercase head, fixed row height, actions LAST column.
 *  Scrolls inside its frame on small screens — the page never scrolls sideways. */
export function DataTable({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-[var(--shadow-sm)]">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-border bg-muted/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground backdrop-blur">
            {head.map((h, i) => <th key={i} className="px-4 py-2.5 font-semibold">{h}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export function Tr({ children }: { children: React.ReactNode }) {
  return <tr className="h-12 border-b border-border transition-colors last:border-0 hover:bg-muted/50">{children}</tr>;
}
export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-2 align-middle", className)}>{children}</td>;
}

/* ── Skeletons ───────────────────────────────────────────── */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function TableSkeleton({ rows = 8, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-sm)]">
      <div className="border-b border-border bg-muted/60 px-4 py-3">
        <Skeleton className="h-3 w-48" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex h-12 items-center gap-6 border-b border-border px-4 last:border-0">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="skeleton h-3.5"
              style={{ width: ["30%", "18%", "22%", "12%"][j % 4] }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton({ table = true }: { table?: boolean }) {
  return (
    <div>
      <Skeleton className="mb-2 h-7 w-56" />
      <Skeleton className="mb-6 h-3.5 w-32" />
      {table ? (
        <TableSkeleton />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-3 h-7 w-14" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
