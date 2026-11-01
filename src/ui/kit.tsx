import { Children, Suspense, cloneElement, isValidElement, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { TableSearch } from "./table-search";
import { PhoneBack } from "./phone-back";

/* Assembly UI kit — one slight curve for actions and structure alike (the
   radius scale lives in globals.css; rounded-full on a padded control resolves to it),
   hairline borders, one accent, stable action placement (doc 06 laws). */

export const inputCls =
  "w-full rounded-md border border-border bg-card px-3 py-2 text-sm shadow-[var(--shadow-sm)] outline-none transition-colors placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-ring/25";
export const btnCls =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-primary px-4.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-sm)] transition-all hover:bg-brand-strong active:scale-[.98] disabled:pointer-events-none disabled:opacity-55";
export const btnGhostCls =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-4 text-sm font-medium shadow-[var(--shadow-sm)] transition-colors hover:border-border-strong hover:bg-muted";
export const btnDangerCls =
  "inline-flex h-9 items-center justify-center rounded-full bg-danger px-4.5 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition-opacity hover:opacity-90";

/** A labelled control. `required` shows a visible marker, `optional` says so
 *  in the label; by default the label says neither. */
export function Field({ label, children, required, optional }: {
  label: string; children: React.ReactNode; required?: boolean; optional?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
        {required && <span className="ml-1.5 normal-case tracking-normal text-danger">required</span>}
        {optional && <span className="ml-1.5 normal-case tracking-normal text-faint">(optional)</span>}
      </span>
      {children}
    </label>
  );
}

/** Page header: title left, ONE primary action top-right. Always. On a
 *  phone a back chevron leads the title (the breadcrumb trail is desktop-only). */
export function PageHeader({ title, sub, action }: {
  title: string; sub?: string; action?: { href: string; label: string } | React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3 lg:mb-6">
      <div className="flex min-w-0 items-start">
        <PhoneBack />
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-tight tracking-[-0.028em]">{title}</h1>
          {sub && <p className="mt-1 text-[14px] text-muted-foreground">{sub}</p>}
        </div>
      </div>
      {action != null && typeof action === "object" && "href" in action
        ? <Link href={action.href} className={btnCls}>{action.label}</Link>
        : (action as React.ReactNode)}
    </div>
  );
}

export function Card({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <div id={id} className={cn(
      "rounded-lg bg-card p-5 shadow-[var(--shadow-md)] transition-shadow",
      className)}>
      {children}
    </div>
  );
}

/** Stat tile for dashboards. Toned tiles are FILLED containers (Assembly):
 *  hero = the school's colour, danger/warning/success = the fixed status
 *  containers with their paired text — never a coloured number on white. */
export function Stat({ label, value, tone, icon, hint }: {
  label: string; value: React.ReactNode; tone?: "hero" | "success" | "danger" | "warning" | "default";
  /** a small mark beside the label, and one line saying what to make of the number */
  icon?: React.ReactNode; hint?: string;
}) {
  const tones = {
    hero: "border-transparent bg-brand-container text-on-brand-container",
    success: "border-transparent bg-success-soft text-success",
    danger: "border-transparent bg-danger-soft text-danger",
    warning: "border-transparent bg-warning-soft text-warning",
    default: "",
  };
  return (
    <Card className={cn("hover:shadow-[var(--shadow-md)]", tones[tone ?? "default"])}>
      <p className={cn("font-mono text-[10.5px] font-medium uppercase tracking-[0.08em]",
        "flex items-center gap-2", tone && tone !== "default" ? "opacity-80" : "text-muted-foreground")}>
        {icon && <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-card/70 shadow-[var(--shadow-sm)]">{icon}</span>}
        {label}
      </p>
      <p data-nums="" className="mt-2 text-[26px] font-bold leading-none tracking-[-0.03em]">
        {value}
      </p>
      {hint && <p className={cn("mt-1.5 text-[13px]", tone && tone !== "default" ? "opacity-80" : "text-muted-foreground")}>{hint}</p>}
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
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-semibold capitalize", tones[tone])}>
      {tone !== "default" && <i aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/** URL-backed tabs — one page, one job (Assembly v2 §09). Pass hrefs that
 *  carry the tab in the query string so refresh, back and shared links all
 *  keep their place. Up to four tabs render as a segmented control on a
 *  phone (one full-width switch under the thumb); more, or any desktop,
 *  is the underlined row. */
export function Tabs({ tabs, active }: {
  tabs: { key: string; label: string; href: string }[]; active: string;
}) {
  const seg = tabs.length <= 4;
  return (
    <div className={cn("mb-5 flex gap-1 overflow-x-auto border-b border-border",
      seg && "max-md:rounded-lg max-md:border-0 max-md:bg-muted max-md:p-1 max-md:gap-0.5")}>
      {tabs.map((t) => (
        <Link key={t.key} href={t.href}
          className={cn("whitespace-nowrap border-b-2 px-3.5 py-2 text-[14px] font-medium transition-colors",
            seg && "max-md:flex-1 max-md:truncate max-md:rounded-md max-md:border-0 max-md:px-2 max-md:text-center",
            active === t.key
              ? cn("border-primary text-primary", seg && "max-md:bg-card max-md:text-foreground max-md:shadow-[var(--shadow-sm)]")
              : "border-transparent text-muted-foreground hover:text-foreground")}>
          {t.label}
        </Link>
      ))}
    </div>
  );
}

/* ── Phone rows, tiles, strips ───────────────────────────────────────────
   The phone language in four pieces. Rows replace collapsed tables; tiles
   are the coloured actions; the strip is a swipe of stats; spots are the
   risograph art. Each works at desktop width too, so dashboards share them. */

/** A risograph spot (public/spot/*.webp) as a rounded square. */
export function Spot({ name, size = 56, className }: { name: string; size?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- static decorative art
  return <img src={`/spot/${name}.webp`} alt="" aria-hidden width={size} height={size} loading="lazy" decoding="async"
    className={cn("shrink-0 rounded-xl object-cover", className)} style={{ width: size, height: size }} />;
}

/** One list row: a leading avatar/tile, a title, one quiet line, and either a
 *  chevron (the whole row is the link) or whatever trailing element is given. */
export function Row({ href, lead, title, sub, trailing, className }: {
  href?: string; lead?: ReactNode; title: ReactNode; sub?: ReactNode; trailing?: ReactNode; className?: string;
}) {
  const body = (
    <>
      {typeof lead === "string"
        ? <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-container text-[13px] font-semibold uppercase text-on-brand-container">{lead}</span>
        : lead && <span className="flex h-10 w-10 shrink-0 items-center justify-center [&>img]:h-10 [&>img]:w-10 [&>img]:rounded-full [&>img]:object-cover">{lead}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold leading-tight">{title}</span>
        {sub && <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">{sub}</span>}
      </span>
      {trailing !== undefined
        ? <span className="flex shrink-0 items-center gap-2 text-right">{trailing}</span>
        : href ? <ChevronRight size={16} className="shrink-0 text-faint" /> : null}
    </>
  );
  const cls = cn("flex min-h-[60px] items-center gap-3 px-4 py-2.5", href && "transition-colors hover:bg-muted/50 active:bg-muted", className);
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}

/** Rows in one lifted surface, hairlines between them. */
export function RowList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("divide-y divide-border overflow-hidden rounded-lg bg-card shadow-[var(--shadow-sm)]", className)}>{children}</div>;
}

/** A coloured action tile with a spot in its corner. Tones are the Assembly
 *  containers; `brand` is the one solid tile a screen gets. */
export function Tile({ href, label, hint, spot, tone = "default", className }: {
  href: string; label: string; hint?: string; spot?: string;
  tone?: "brand" | "soft" | "success" | "warning" | "danger" | "default"; className?: string;
}) {
  const tones = {
    brand: "bg-primary text-primary-foreground [&_small]:text-brand-container",
    soft: "bg-brand-container text-on-brand-container [&_small]:opacity-75",
    success: "bg-success-soft text-success [&_small]:opacity-80",
    warning: "bg-warning-soft text-warning [&_small]:opacity-80",
    danger: "bg-danger-soft text-danger [&_small]:opacity-80",
    default: "bg-card text-foreground [&_small]:text-muted-foreground",
  };
  return (
    <Link href={href} className={cn("relative flex min-h-[92px] flex-col justify-end overflow-hidden rounded-lg p-3.5 shadow-[var(--shadow-sm)] transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]", tones[tone], className)}>
      {spot && <Spot name={spot} size={64} className="absolute -right-2 -top-2 opacity-95" />}
      <span className="relative text-[14.5px] font-semibold leading-tight">{label}</span>
      {hint && <small className="relative mt-0.5 block text-[12px]">{hint}</small>}
    </Link>
  );
}

/** Stats: a grid on desktop, one swipe strip on a phone. */
export function StatStrip({ children, cols = 4, className }: { children: ReactNode; cols?: 2 | 3 | 4; className?: string }) {
  const grid = { 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-2 lg:grid-cols-4" }[cols];
  return (
    <div className={cn("mb-4 gap-3 max-md:-mx-4 max-md:flex max-md:snap-x max-md:overflow-x-auto max-md:px-4 max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden max-md:[&>*]:w-[150px] max-md:[&>*]:shrink-0 max-md:[&>*]:snap-start md:grid", grid, className)}>
      {children}
    </div>
  );
}

/** Section header above a list or sheet: a title, an optional count, one link. */
export function SectionHead({ title, sub, link, className }: {
  title: ReactNode; sub?: ReactNode; link?: { href: string; label: string }; className?: string;
}) {
  return (
    <div className={cn("mb-2.5 mt-6 flex items-baseline justify-between gap-3", className)}>
      <h2 className="text-[16px] font-semibold">{title}{sub && <span className="ml-2 text-[13px] font-normal text-muted-foreground">{sub}</span>}</h2>
      {link && <Link href={link.href} className="shrink-0 text-[13.5px] font-semibold text-primary">{link.label} →</Link>}
    </div>
  );
}

/** One banner for every page-level notice (trial, payment, frozen, wallet,
 *  import issues): a lead, one line, one action on the right, same everywhere. */
export function Banner({ tone = "brand", children, action, className }: {
  tone?: "brand" | "warning" | "danger" | "muted"; children: ReactNode;
  action?: { href: string; label: string } | ReactNode; className?: string;
}) {
  const tones = {
    brand: "border-primary/30 bg-brand-soft",
    warning: "border-warning/50 bg-warning-soft",
    danger: "border-danger/40 bg-danger-soft",
    muted: "border-border bg-card",
  };
  return (
    <div className={cn("mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border-l-4 border px-4 py-3 text-[14px] shadow-[var(--shadow-sm)]", tones[tone], className)}>
      <div className="min-w-0 flex-1">{children}</div>
      {action != null && typeof action === "object" && "href" in action
        ? <a href={action.href} className="shrink-0 rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:bg-brand-strong">{action.label}</a>
        : (action as ReactNode)}
    </div>
  );
}

/** An empty screen is a fork: it either teaches or it loses someone. A
 *  risograph picture (public/spot/empty-*.webp) on kraft, one line of why
 *  this screen will matter, and the action — never bare "no data". Without
 *  `art` it is the quieter dashed outline. */
export function Empty({ title, hint, action, icon, art }: {
  title: string; hint?: string; action?: React.ReactNode; icon?: React.ReactNode;
  /** a file under public/spot, e.g. "empty-students" */
  art?: string;
}) {
  if (art) {
    return (
      <div className="rounded-lg bg-kraft px-6 py-7 text-center text-on-kraft shadow-[var(--shadow-sm)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- static decorative art */}
        <img src={`/spot/${art}.webp`} alt="" aria-hidden width={240} height={160} loading="lazy" decoding="async"
          className="mx-auto mb-4 h-40 w-60 rounded-xl object-cover" />
        <p className="text-[17px] font-semibold">{title}</p>
        {hint && <p className="mx-auto mt-1.5 max-w-sm text-[14px] opacity-80">{hint}</p>}
        {action && <div className="mt-4 flex justify-center gap-2">{action}</div>}
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-dashed border-border-strong bg-card/60 px-8 py-14 text-center">
      {icon && <div className="mb-3 flex justify-center text-muted-foreground">{icon}</div>}
      <p className="font-medium">{title}</p>
      {hint && <p className="mx-auto mt-1.5 max-w-sm text-[14px] text-muted-foreground">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/** Tag each Td with its column header so the phone card list (globals.css
 *  `.data-table`) can print "Header: value". Rows that are not a literal
 *  <Tr> (a custom row component) render as cards without the labels. */
function labelCells(rows: ReactNode, head: string[]): ReactNode {
  return Children.map(rows, (row) => {
    if (!isValidElement<{ children?: ReactNode }>(row) || row.type !== Tr) return row;
    const cells = Children.map(row.props.children, (cell, i) =>
      isValidElement<{ "data-label"?: string }>(cell) && cell.type === Td
        ? cloneElement(cell, { "data-label": head[i] ?? "" })
        : cell);
    return cloneElement(row, {}, cells);
  });
}

/** Data table: sticky uppercase head, fixed row height, actions LAST column.
 *  Below md every row becomes a card of "Header: value" lines, so the page
 *  never scrolls sideways. `search` puts a name box above the table bound
 *  to a URL param (the URL is the state; the page reads it from searchParams). */
export function DataTable({ head, children, search }: {
  head: string[]; children: React.ReactNode;
  search?: { placeholder?: string; param?: string };
}) {
  return (
    <div className="data-table overflow-x-auto rounded-lg bg-card shadow-[var(--shadow-md)]">
      {search && (
        <Suspense fallback={<div className="h-14" />}>
          <TableSearch placeholder={search.placeholder} param={search.param} />
        </Suspense>
      )}
      <table className="w-full min-w-[560px] text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-border bg-muted/60 text-left font-mono text-[10.5px] uppercase tracking-[0.07em] text-muted-foreground backdrop-blur">
            {head.map((h, i) => <th key={i} className="px-4 py-2.5 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody>{labelCells(children, head)}</tbody>
      </table>
    </div>
  );
}
export function Tr({ children }: { children: React.ReactNode }) {
  return <tr className="h-12 border-b border-border transition-colors last:border-0 hover:bg-muted/50">{children}</tr>;
}
export function Td({ children, className, ...rest }: { children?: React.ReactNode; className?: string; "data-label"?: string }) {
  return <td {...rest} className={cn("px-4 py-2 align-middle", className)}>{children}</td>;
}

/* ── Skeletons ───────────────────────────────────────────── */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function TableSkeleton({ rows = 8, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-lg bg-card shadow-[var(--shadow-md)]">
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
            <div key={i} className="rounded-lg bg-card p-5 shadow-[var(--shadow-md)]">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-3 h-7 w-14" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
