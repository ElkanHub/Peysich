"use client";
import { useEffect, useRef, useState } from "react";
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

/* Assembly groups: Learn / Money / Operate. Labels not listed here (the
 * platform console, portals) fall into an uncaptioned leading group, so
 * every nav renders correctly whether or not it matches the school map. */
const NAV_GROUPS: [string, string[]][] = [
  ["Learn", ["Dashboard", "Students", "Guardians", "Attendance", "Assessment", "Reports", "Timetable", "Homework"]],
  ["Money", ["Fees", "Billing"]],
  ["Operate", ["Staff", "Staff HR", "Admissions", "Announcements", "Calendar", "Library", "Transport", "Inventory", "Analytics", "Settings"]],
];

function NavLinks({ items, onNavigate }: { items: NavEntry[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const grouped = new Set(NAV_GROUPS.flatMap(([, ls]) => ls));
  const groups: [string, NavEntry[]][] = ([
    ["", items.filter((n) => !grouped.has(n.label))] as [string, NavEntry[]],
    ...NAV_GROUPS.map(([g, ls]) =>
      [g, items.filter((n) => ls.includes(n.label))] as [string, NavEntry[]]),
  ]).filter(([, ls]) => ls.length > 0);
  const captions = groups.filter(([g]) => g).length > 1; // one lonely group needs no caption

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-3">
      {groups.map(([g, ls]) => (
        <div key={g || "core"} className="mb-1.5">
          {captions && g && (
            <p className="px-3 pb-1 pt-2 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-ink-text/50">{g}</p>
          )}
          <div className="space-y-0.5">
            {ls.map((n) => {
              const href = `/${n.href.replace(/^\//, "")}` || "/";
              const isRoot = href === "/" || href === "/platform";
              const active = isRoot ? pathname === href : pathname === href || pathname.startsWith(href + "/");
              const Icon = ICONS[n.label] ?? LayoutDashboard;
              return (
                <Link key={n.label + href} href={href} onClick={onNavigate}
                  className={cn(
                    "group relative flex h-9 items-center gap-3 rounded-full px-3.5 text-[14px] font-medium transition-colors",
                    active
                      ? "bg-ink-active font-semibold text-ink-text-strong"
                      : "text-ink-text hover:bg-ink-2 hover:text-ink-text-strong")}>
                  <Icon size={16} strokeWidth={active ? 2.2 : 1.8}
                    className={cn("shrink-0", active ? "text-ink-text-strong" : "text-ink-text/70 group-hover:text-ink-text-strong")} />
                  {n.label}
                  {typeof n.badge === "number" && n.badge > 0 && (
                    <span className="ml-auto rounded-full bg-warning px-1.5 py-0.5 text-[11px] font-bold leading-none text-white"
                      data-nums="" aria-label={`${n.badge} needing attention`}>
                      {n.badge > 99 ? "99+" : n.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
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

const DRAWER_W = 288;

/** Responsive chrome: fixed ink sidebar ≥lg; below, a drawer that behaves
 *  like a native one — swipe in from the left edge, it follows the finger,
 *  springs open past the threshold, and swipes back closed. */
export function AppNav(props: { schoolName: string; role: string; userName: string; items: NavEntry[]; subtitle?: string; accountHref?: string; avatarUrl?: string | null }) {
  const [open, setOpen] = useState(false);
  const [dragX, setDragX] = useState<number | null>(null); // live finger position
  const touch = useRef<{ x: number; y: number; horizontal: boolean | null; from: "edge" | "drawer"; at: number | null } | null>(null);

  const start = (e: React.TouchEvent, from: "edge" | "drawer") => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, horizontal: null, from, at: null };
  };
  const move = (e: React.TouchEvent) => {
    const s = touch.current;
    if (!s) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (s.horizontal === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8))
      s.horizontal = Math.abs(dx) > Math.abs(dy); // decide intent once
    if (!s.horizontal) return;
    s.at = s.from === "edge"
      ? Math.max(0, Math.min(DRAWER_W, dx))
      : Math.max(0, Math.min(DRAWER_W, DRAWER_W + dx));
    setDragX(s.at);
  };
  const end = () => {
    const s = touch.current;
    touch.current = null;
    if (!s || s.at === null) return;
    setOpen(s.from === "edge" ? s.at > 72 : s.at > DRAWER_W - 72);
    setDragX(null);
  };

  /* Whole-screen swipe-to-open (phones own the edges for their OS gestures).
   * A gesture is NOT claimed when it starts inside anything that scrolls or
   * pans horizontally itself — tables, the timetable, chip rows, canvases,
   * form controls — so those keep their native behaviour. */
  const openRef = useRef(open);
  openRef.current = open;
  const settledAt = useRef(0); // swallow the ghost click a touch gesture leaves behind
  useEffect(() => {
    const ownsHorizontal = (el: EventTarget | null) => {
      for (let n = el instanceof Element ? el : null; n && n !== document.body; n = n.parentElement) {
        if (/^(CANVAS|INPUT|TEXTAREA|SELECT)$/.test(n.tagName)) return true;
        const st = getComputedStyle(n);
        if (/(auto|scroll)/.test(st.overflowX) && n.scrollWidth > n.clientWidth + 4) return true;
        if (/none|pan-x/.test(st.touchAction)) return true;
      }
      return false;
    };
    const onStart = (e: TouchEvent) => {
      if (window.innerWidth >= 1024 || openRef.current) return;
      if (ownsHorizontal(e.target)) return;
      const t = e.touches[0];
      touch.current = { x: t.clientX, y: t.clientY, horizontal: null, from: "edge", at: null };
    };
    const onMove = (e: TouchEvent) => {
      const s = touch.current;
      if (!s || s.from !== "edge" || openRef.current) return;
      const t = e.touches[0];
      const dx = t.clientX - s.x, dy = t.clientY - s.y;
      if (s.horizontal === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        s.horizontal = Math.abs(dx) > Math.abs(dy) && dx > 0; // rightward only
        if (!s.horizontal) { touch.current = null; return; }
      }
      if (!s.horizontal) return;
      s.at = Math.max(0, Math.min(DRAWER_W, dx));
      setDragX(s.at);
    };
    const onEnd = () => {
      const s = touch.current;
      if (!s || s.from !== "edge") return;
      touch.current = null;
      if (s.at === null) return;
      settledAt.current = Date.now();
      if (s.at > 10) {
        // a touch gesture leaves one synthesized click behind — swallow it
        // before it "taps" whatever sits under the finger's release point
        const swallow = (ev: MouseEvent) => { ev.preventDefault(); ev.stopPropagation(); cleanup(); };
        const cleanup = () => { document.removeEventListener("click", swallow, true); clearTimeout(tm); };
        document.addEventListener("click", swallow, true);
        const tm = setTimeout(cleanup, 500);
      }
      setOpen(s.at > 72);
      setDragX(null);
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  const x = dragX ?? (open ? DRAWER_W : 0); // 0 = closed, DRAWER_W = open
  const dragging = dragX !== null;

  return (
    <>
      <aside className="hidden w-60 shrink-0 print:hidden lg:block">
        <div className="fixed inset-y-0 w-60"><SidebarInner {...props} /></div>
      </aside>
      {/* mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-13 items-center gap-3 bg-ink px-4 py-2.5 print:hidden lg:hidden">
        <button onClick={() => setOpen(true)} aria-label="Open menu"
          className="rounded-md p-1.5 text-ink-text hover:bg-ink-2">
          <Menu size={20} />
        </button>
        <LogoMark size={24} variant="light" />
        <span className="truncate text-[14px] font-semibold text-ink-text-strong">{props.schoolName}</span>
      </div>
      {/* drawer + scrim, always mounted so the gesture can drive them */}
      <div className={`fixed inset-0 z-50 lg:hidden print:hidden ${x === 0 && !dragging ? "pointer-events-none" : ""}`}
        onTouchStart={(e) => start(e, "drawer")} onTouchMove={move} onTouchEnd={end}>
        <div className="absolute inset-0 bg-black/50"
          style={{ opacity: x / DRAWER_W, transition: dragging ? "none" : "opacity 260ms cubic-bezier(.32,.72,0,1)" }}
          onClick={() => { if (Date.now() - settledAt.current > 450) setOpen(false); }} />
        <div className="absolute inset-y-0 left-0 w-72 shadow-[var(--shadow-lg)]"
          style={{ transform: `translateX(${x - DRAWER_W}px)`,
            transition: dragging ? "none" : "transform 260ms cubic-bezier(.32,.72,0,1)",
            touchAction: "pan-y" }}>
          <SidebarInner {...props} onNavigate={() => setOpen(false)} />
          <button onClick={() => setOpen(false)} aria-label="Close menu"
            className="absolute right-3 top-4 rounded-md p-1.5 text-ink-text hover:bg-ink-2">
            <X size={18} />
          </button>
        </div>
      </div>
    </>
  );
}
