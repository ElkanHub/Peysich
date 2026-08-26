"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, HeartHandshake, BriefcaseBusiness, Settings, CreditCard,
  CalendarCheck, GraduationCap, CalendarDays, BookOpen, Megaphone, Wallet,
  UserPlus, Library, Bus, Boxes, Briefcase, BarChart3, ClipboardList, Menu, X,
  CalendarRange,
  School, ListChecks, Inbox, Radio, ScrollText, Banknote,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoMark } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { SignOutButton, SwitchAccountButton } from "./signout";

const ICONS: Record<string, LucideIcon> = {
  Dashboard: LayoutDashboard, Students: Users, Guardians: HeartHandshake,
  Staff: BriefcaseBusiness, Settings, Billing: CreditCard,
  Attendance: CalendarCheck, Assessment: GraduationCap, Reports: ClipboardList,
  Timetable: CalendarDays, Homework: BookOpen, Announcements: Megaphone, Fees: Wallet,
  Calendar: CalendarRange,
  Admissions: UserPlus, Library, Transport: Bus, Inventory: Boxes,
  "Staff HR": Briefcase, Analytics: BarChart3,
  Overview: LayoutDashboard, Schools: School, Onboarding: ListChecks, Leads: Inbox,
  Subscriptions: CreditCard, Financials: Banknote, Broadcast: Radio,
  "All users": Users, "Audit log": ScrollText, "My Account": Users,
};

export type NavEntry = { label: string; href: string; badge?: number };

function NavLinks({ items, onNavigate }: { items: NavEntry[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
      {items.map((n) => {
        const href = `/${n.href.replace(/^\//, "")}` || "/";
        const isRoot = href === "/" || href === "/platform";
        const active = isRoot ? pathname === href : pathname === href || pathname.startsWith(href + "/");
        const Icon = ICONS[n.label] ?? LayoutDashboard;
        return (
          <Link key={n.label + href} href={href} onClick={onNavigate}
            className={cn(
              "group relative flex h-9 items-center gap-3 rounded-md px-3 text-[14px] font-medium transition-colors",
              active
                ? "bg-ink-active text-ink-text-strong"
                : "text-ink-text hover:bg-ink-2 hover:text-ink-text-strong")}>
            {active && <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" />}
            <Icon size={16} strokeWidth={active ? 2.2 : 1.8}
              className={cn("shrink-0", active ? "text-ink-text-strong" : "text-ink-text/70 group-hover:text-ink-text-strong")} />
            {n.label}
            {typeof n.badge === "number" && n.badge > 0 && (
              <span className="ml-auto rounded-full bg-warning px-1.5 py-0.5 text-[11px] font-bold leading-none text-ink"
                data-nums="" aria-label={`${n.badge} needing attention`}>
                {n.badge > 99 ? "99+" : n.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarInner({ schoolName, role, userName, items, onNavigate, subtitle = "Peysich", accountHref = "/account", avatarUrl }: {
  schoolName: string; role: string; userName: string; items: NavEntry[]; onNavigate?: () => void;
  subtitle?: string; accountHref?: string; avatarUrl?: string | null;
}) {
  return (
    <div className="flex h-full flex-col bg-ink">
      <div className="flex items-center gap-2.5 border-b border-ink-border px-4 py-4">
        <LogoMark size={30} variant="light" />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold leading-tight text-ink-text-strong">{schoolName}</p>
          <p className="text-[12px] text-ink-text/60">{subtitle}</p>
        </div>
      </div>
      <NavLinks items={items} onNavigate={onNavigate} />
      <div className="border-t border-ink-border p-3">
        <Link href={accountHref} onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-ink-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink-active text-[12px] font-semibold uppercase text-ink-text-strong">
            {avatarUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              : userName.slice(0, 2)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-medium text-ink-text-strong">{userName}</span>
            <span className="block text-[12px] capitalize text-ink-text/60">{role.replace("_", " ")}</span>
          </span>
        </Link>
        <div className="flex items-center justify-between gap-2 px-2 pt-1">
          <SignOutButton /><SwitchAccountButton /><ThemeToggle />
        </div>
      </div>
    </div>
  );
}

/** Responsive chrome: fixed ink sidebar ≥lg, slide-in drawer below. */
export function AppNav(props: { schoolName: string; role: string; userName: string; items: NavEntry[]; subtitle?: string; accountHref?: string; avatarUrl?: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <aside className="hidden w-60 shrink-0 print:hidden lg:block">
        <div className="fixed inset-y-0 w-60"><SidebarInner {...props} /></div>
      </aside>
      {/* mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-13 items-center gap-3 border-b border-ink-border bg-ink px-4 py-2.5 print:hidden lg:hidden">
        <button onClick={() => setOpen(true)} aria-label="Open menu"
          className="rounded-md p-1.5 text-ink-text hover:bg-ink-2">
          <Menu size={20} />
        </button>
        <LogoMark size={24} variant="light" />
        <span className="truncate text-[14px] font-semibold text-ink-text-strong">{props.schoolName}</span>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 shadow-[var(--shadow-lg)]">
            <SidebarInner {...props} onNavigate={() => setOpen(false)} />
            <button onClick={() => setOpen(false)} aria-label="Close menu"
              className="absolute right-3 top-4 rounded-md p-1.5 text-ink-text hover:bg-ink-2">
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
