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
  report: "Report card", platform: "Console", schools: "Schools", audit: "Audit log",
  onboarding: "Onboarding", leads: "Leads", subscriptions: "Subscriptions",
  financials: "Financials", broadcast: "Broadcast", users: "All users",
  edit: "Edit",
};

/** Path-derived breadcrumbs; id-looking segments render as a neutral marker. */
export function Breadcrumbs({ root = "Home" }: { root?: string }) {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const crumbs = parts.map((seg, i) => ({
    label: LABELS[seg] ?? (/^[0-9a-f-]{16,}$/i.test(seg) ? "Detail" : seg),
    href: "/" + parts.slice(0, i + 1).join("/"),
    last: i === parts.length - 1,
  }));
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-[13px]">
      <Link href="/" className="shrink-0 text-muted-foreground transition-colors hover:text-foreground">{root}</Link>
      {crumbs.map((c) => (
        <span key={c.href} className="flex min-w-0 items-center gap-1">
          <ChevronRight size={13} className="shrink-0 text-faint" />
          {c.last
            ? <span className="truncate font-medium text-foreground">{c.label}</span>
            : <Link href={c.href} className="truncate text-muted-foreground transition-colors hover:text-foreground">{c.label}</Link>}
        </span>
      ))}
    </nav>
  );
}
