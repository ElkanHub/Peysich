"use client";
import { usePathname } from "next/navigation";
import { Skeleton, TableSkeleton } from "./kit";

/* ── Loading frame ──────────────────────────────────────────────────────────
   A page that is still loading says WHAT is loading and takes the shape of
   what's coming: a roster gets a table, a dashboard gets its stat tiles, a
   file gets its header + cards. Reads the URL so one component serves every
   route — no per-page skeleton drift. */

type Shape = "table" | "tiles" | "file" | "form";

const PAGES: [RegExp, string, Shape][] = [
  [/\/students\/import/, "the import sheet", "form"],
  [/\/students\/[^/]+/, "the student file", "file"],
  [/\/students/, "students", "table"],
  [/\/guardians/, "guardians", "table"],
  [/\/staff\/allocations/, "teaching allocations", "table"],
  [/\/staff\/[^/]+/, "the staff file", "file"],
  [/\/staff/, "staff", "table"],
  [/\/attendance\/register/, "the record book", "table"],
  [/\/attendance\/[^/]+/, "the register", "table"],
  [/\/attendance/, "attendance", "tiles"],
  [/\/assessment/, "assessment", "table"],
  [/\/reports/, "report cards", "table"],
  [/\/timetable/, "the timetable", "table"],
  [/\/homework/, "homework", "table"],
  [/\/fees\/(invoice|receipt)/, "the paper", "file"],
  [/\/fees\/setup/, "the fee catalog", "form"],
  [/\/fees/, "the fees desk", "tiles"],
  [/\/comms/, "announcements", "table"],
  [/\/calendar/, "the calendar", "table"],
  [/\/admissions\/[^/]+/, "the applicant file", "file"],
  [/\/admissions/, "admissions", "table"],
  [/\/analytics/, "analytics", "tiles"],
  [/\/library/, "the library", "table"],
  [/\/transport/, "transport", "table"],
  [/\/inventory/, "inventory", "table"],
  [/\/hr/, "staff HR", "table"],
  [/\/settings/, "settings", "form"],
  [/\/billing/, "billing", "tiles"],
  [/\/account/, "your account", "form"],
  [/\/children\/[^/]+/, "your child's file", "file"],
  [/\/platform\/(schools|leads|requests|subscriptions|users|audit|plans)/, "the console", "table"],
  [/\/platform/, "the console", "tiles"],
];

export function LoadingFrame({ shape: forced, label: forcedLabel }: { shape?: Shape; label?: string } = {}) {
  const pathname = usePathname() ?? "";
  const hit = PAGES.find(([re]) => re.test(pathname));
  const label = forcedLabel ?? hit?.[1] ?? "your dashboard";
  const shape: Shape = forced ?? hit?.[2] ?? "tiles";

  return (
    <div aria-busy="true" aria-live="polite" data-loading="">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <Skeleton className="h-7 w-56" />
          <Skeleton className="mt-2 h-3.5 w-32" />
        </div>
        <p className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          Loading {label}
        </p>
      </div>
      {shape === "table" && <TableSkeleton />}
      {shape === "tiles" && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg bg-card p-5 shadow-[var(--shadow-md)]">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-3 h-7 w-14" />
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg bg-card p-5 shadow-[var(--shadow-md)] lg:col-span-2">
              <Skeleton className="h-4 w-40" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="mt-4 flex items-center gap-4">
                  <Skeleton className="h-3.5 w-24" /><Skeleton className="h-2 flex-1" /><Skeleton className="h-3.5 w-16" />
                </div>
              ))}
            </div>
            <div className="rounded-lg bg-card p-5 shadow-[var(--shadow-md)]">
              <Skeleton className="h-4 w-28" />
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="mt-3 h-9 w-full" />)}
            </div>
          </div>
        </>
      )}
      {shape === "file" && (
        <>
          <div className="flex items-center gap-4 rounded-lg bg-card p-5 shadow-[var(--shadow-md)]">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="flex-1"><Skeleton className="h-5 w-48" /><Skeleton className="mt-2 h-3.5 w-32" /></div>
          </div>
          <div className="mt-4 flex gap-1 border-b border-border pb-2">
            {[64, 80, 56, 72].map((w, i) => <div key={i} className="skeleton h-4" style={{ width: w }} />)}
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg bg-card p-5 shadow-[var(--shadow-md)]">
                <Skeleton className="h-3 w-24" /><Skeleton className="mt-3 h-4 w-40" /><Skeleton className="mt-2 h-4 w-28" />
              </div>
            ))}
          </div>
        </>
      )}
      {shape === "form" && (
        <div className="max-w-2xl space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg bg-card p-5 shadow-[var(--shadow-md)]">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="mt-4 h-10 w-full" />
              <Skeleton className="mt-3 h-10 w-2/3" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
