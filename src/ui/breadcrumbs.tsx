"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

const LABELS: Record<string, string> = {
  students: "Students", new: "New", import: "Import", guardians: "Guardians",
  staff: "Staff", settings: "Settings", billing: "Billing", account: "My Account",
  attendance: "Attendance", assessment: "Assessment", matrix: "Term closing",
  skills: "Skills", timetable: "Timetable", homework: "Homework", comms: "Announcements",
  fees: "Fees", admissions: "Admissions", library: "Library", transport: "Transport",
  inventory: "Inventory", hr: "Staff HR", analytics: "Analytics", children: "My Children",
  report: "Report card", reports: "Reports", performance: "Performance",
  calendar: "Calendar", register: "Record book",
  setup: "Catalog & settings", invoice: "Invoice", receipt: "Receipt",
  offer: "Offer letter",
  "no-access": "No access",
  platform: "Console", schools: "Schools", audit: "Audit log",
  onboarding: "Onboarding", leads: "Leads", subscriptions: "Subscriptions",
  financials: "Financials", broadcast: "Broadcast", users: "All users",
  edit: "Edit", enroll: "Enrol", promotion: "Promotion", exit: "Exit",
  allocations: "Teaching & allocations",
  "leaving-certificate": "Leaving certificate",
};

const isId = (seg: string) => /^[0-9a-f-]{16,}$/i.test(seg) || /^[A-Za-z0-9_-]{20,}$/.test(seg);

/** Path-derived breadcrumbs. Only crumbs that are REAL pages become links:
 *  the tenant prefix (/s/{slug}) is folded into the root, id segments and
 *  unknown middles render as plain text — no more 404s from the trail. */
export function Breadcrumbs({ root = "Home" }: { root?: string }) {
  const pathname = usePathname();
  let parts = pathname.split("/").filter(Boolean);
  let base = "";
  // tenant routes live under /s/{slug} — that prefix IS the root crumb
  if (parts[0] === "s" && parts.length >= 2) {
    base = `/${parts[0]}/${parts[1]}`;
    parts = parts.slice(2);
  }
  const crumbs = parts.map((seg, i) => ({
    label: LABELS[seg] ?? (isId(seg) ? "Detail" : seg),
    href: base + "/" + parts.slice(0, i + 1).join("/"),
    // link only the module root (first segment) — deeper paths need params
    // the trail can't know, so they stay text instead of risking a 404
    linkable: i === 0 && !!LABELS[seg],
    last: i === parts.length - 1,
  }));
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-[14px]">
      <Link href={base || "/"} className="shrink-0 text-muted-foreground transition-colors hover:text-foreground">{root}</Link>
      {crumbs.map((c) => (
        <span key={c.href} className="flex min-w-0 items-center gap-1">
          <ChevronRight size={13} className="shrink-0 text-faint" />
          {c.last
            ? <span className="truncate font-medium text-foreground">{c.label}</span>
            : c.linkable
              ? <Link href={c.href} className="truncate text-muted-foreground transition-colors hover:text-foreground">{c.label}</Link>
              : <span className="truncate text-muted-foreground">{c.label}</span>}
        </span>
      ))}
    </nav>
  );
}
