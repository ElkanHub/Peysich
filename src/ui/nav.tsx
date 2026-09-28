"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, HeartHandshake, BriefcaseBusiness, Settings, CreditCard,
  CalendarCheck, GraduationCap, CalendarDays, BookOpen, Megaphone, Wallet,
  UserPlus, Library, Bus, Boxes, Briefcase, BarChart3, ClipboardList, Menu, X,
  CalendarRange,
  School, ListChecks, Inbox, Radio, ScrollText, Banknote,
  ArrowLeftRight, Sun, Moon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoMark } from "./logo";
import { SignOutButton } from "./signout";
import { authClient } from "@/lib/auth-client";
import { rememberAccount } from "@/lib/device-accounts";
import { ProductTour, TourRelaunch } from "./tour";

const ICONS: Record<string, LucideIcon> = {
  Home: LayoutDashboard, Students: Users, Parents: HeartHandshake,
  Staff: BriefcaseBusiness, "School settings": Settings, "Your SchoolSpec plan": CreditCard,
  Attendance: CalendarCheck, Scores: GraduationCap, "Report cards": ClipboardList,
  Timetable: CalendarDays, Homework: BookOpen, Announcements: Megaphone, Fees: Wallet,
  Calendar: CalendarRange,
  Admissions: UserPlus, Library, Transport: Bus, Inventory: Boxes,
  Leave: Briefcase, Analytics: BarChart3, Settings,
  Overview: LayoutDashboard, Schools: School, Onboarding: ListChecks, Leads: Inbox,
  Plans: ClipboardList, Requests: Inbox,
  Subscriptions: CreditCard, Financials: Banknote, Broadcast: Radio,
  "All users": Users, "Audit log": ScrollText, "My Account": Users,
};

export type NavEntry = { label: string; href: string; badge?: number };

/* Groups by WHEN you use it, not what it is. Labels not listed here (the
 * platform console) fall into an uncaptioned leading group, so every nav
 * renders correctly whether or not it matches the school map. */
const NAV_GROUPS: [string, string[]][] = [
  ["Every day", ["Home", "Attendance", "Scores", "Fees", "Announcements"]],
  ["People", ["Students", "Parents", "Staff", "Admissions"]],
  ["This term", ["Report cards", "Timetable", "Calendar", "Homework"]],
  ["Extras", ["Library", "Transport", "Inventory", "Leave", "Analytics"]],
  ["Setup", ["School settings", "Your SchoolSpec plan"]],
];

/* Phone bottom tabs: three page tabs per role + Menu, each with its word.
 * A tab whose page is not on this person's nav (module off, tab not
 * granted) is dropped rather than shown dead. */
const TABS: Record<string, { label: string; href: string; icon: LucideIcon }[]> = {
  admin: [
    { label: "Home", href: "/", icon: LayoutDashboard },
    { label: "Attendance", href: "/attendance", icon: CalendarCheck },
    { label: "Fees", href: "/fees", icon: Wallet },
  ],
  teacher: [
    { label: "Register", href: "/attendance", icon: CalendarCheck },
    { label: "Scores", href: "/assessment", icon: GraduationCap },
    { label: "Homework", href: "/homework", icon: BookOpen },
  ],
  parent: [
    { label: "My children", href: "/", icon: HeartHandshake },
    { label: "Fees", href: "/fees", icon: Wallet },
    { label: "Notices", href: "/comms", icon: Megaphone },
  ],
  student: [
    { label: "Today", href: "/", icon: LayoutDashboard },
    { label: "Homework", href: "/homework", icon: BookOpen },
    // ponytail: results live at /students/{id}/performance/{term}, ids the nav
    // does not have, so the tab lands on the dashboard, which links them
    { label: "Results", href: "/", icon: ClipboardList },
  ],
};

const isActive = (pathname: string, href: string) => {
  const isRoot = href === "/" || href === "/platform";
  return isRoot ? pathname === href : pathname === href || pathname.startsWith(href + "/");
};

/** The nav in its captioned groups — shared with the walkthrough's drawing
 *  of the menu, so the picture shows exactly this person's menu. */
export function groupNav(items: NavEntry[]): [string, NavEntry[]][] {
  const grouped = new Set(NAV_GROUPS.flatMap(([, ls]) => ls));
  return ([
    ["", items.filter((n) => !grouped.has(n.label))] as [string, NavEntry[]],
    ...NAV_GROUPS.map(([g, ls]) =>
      [g, items.filter((n) => ls.includes(n.label))] as [string, NavEntry[]]),
  ]).filter(([, ls]) => ls.length > 0);
}
/** Phone tabs this person actually gets (see TABS). */
export function tabsFor(role: string, items: NavEntry[]) {
  const hrefs = new Set(items.map((n) => `/${n.href.replace(/^\//, "")}`));
  return (TABS[role] ?? []).filter((t) => hrefs.has(t.href)).map((t) => t.label);
}

function NavLinks({ items, onNavigate }: { items: NavEntry[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const groups = groupNav(items);
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
              const active = isActive(pathname, href);
              const Icon = ICONS[n.label] ?? LayoutDashboard;
              return (
                <Link key={n.label + href} href={href} onClick={onNavigate} data-tour={n.label}
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

function SidebarInner({ schoolName, role, userName, items, onNavigate, subtitle = "SchoolSpec", accountHref = "/account", avatarUrl }: {
  schoolName: string; role: string; userName: string; items: NavEntry[]; onNavigate?: () => void;
  subtitle?: string; accountHref?: string; avatarUrl?: string | null;
}) {
  return (
    <div className="flex h-full flex-col bg-ink pt-[var(--sat)]">
      <div className="flex items-center gap-2.5 border-b border-ink-border px-4 py-4">
        <LogoMark size={30} variant="light" />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold leading-tight text-ink-text-strong">{schoolName}</p>
          <p className="text-[12px] text-ink-text/60">{subtitle}</p>
        </div>
      </div>
      <NavLinks items={items} onNavigate={onNavigate} />
      <div className="border-t border-ink-border p-3">
        <Link href={accountHref} onClick={onNavigate} data-tour="Account"
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
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 px-2 pt-1">
          <SignOutButton />
          <button type="button" onClick={switchAccount} className={footerBtn}>
            <ArrowLeftRight size={12} /> Switch account
          </button>
          <TourRelaunch />
          <ThemeWord />
        </div>
      </div>
    </div>
  );
}

const footerBtn = "flex h-8 items-center gap-1.5 text-[12px] font-medium text-ink-text/60 transition-colors hover:text-ink-text-strong";

/** Same as SignOutButton, but lands on the account picker (a teacher who is
 *  also a parent). Lives here so the footer can say "Switch account" in full. */
async function switchAccount() {
  try {
    const s = await authClient.getSession();
    const u = s.data?.user as { email?: string; name?: string; username?: string | null } | undefined;
    const id = u?.username || u?.email;
    if (id) rememberAccount({ id, name: u?.name });
  } catch { /* purely a convenience */ }
  await authClient.signOut();
  // a full load on purpose: the session cookie is gone, nothing client-side should survive
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = "/sign-in?switch=1";
}

/** Light/dark switch that says which one you will get. The html class is
 *  the source of truth (the root layout sets it before first paint). */
const themeListeners = new Set<() => void>();
const subscribeTheme = (fn: () => void) => { themeListeners.add(fn); return () => { themeListeners.delete(fn); }; };
function ThemeWord() {
  const dark = useSyncExternalStore(subscribeTheme,
    () => document.documentElement.classList.contains("dark"), () => false);
  const flip = () => {
    const next = !dark;
    try {
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("schoolspec-theme", next ? "dark" : "light");
    } catch { /* storage blocked: theme still flips for this page */ }
    themeListeners.forEach((fn) => fn());
  };
  return (
    <button type="button" onClick={flip} className={footerBtn}>
      {dark ? <Sun size={12} /> : <Moon size={12} />} {dark ? "Light" : "Dark"}
    </button>
  );
}

/** Phone bottom tabs (below lg): three page tabs + Menu, every one with its word. */
function BottomTabs({ role, items, openMenu }: { role: string; items: NavEntry[]; openMenu: () => void }) {
  const pathname = usePathname();
  const hrefs = new Set(items.map((n) => `/${n.href.replace(/^\//, "")}`));
  const tabs = (TABS[role] ?? []).filter((t) => hrefs.has(t.href));
  if (tabs.length === 0) return null;
  const cls = "flex h-12 flex-1 flex-col items-center justify-center gap-1 rounded-md text-[12px] font-medium leading-none";
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-ink-border bg-ink px-1 pb-[var(--sab)] pt-1 print:hidden lg:hidden">
      {tabs.map((t) => {
        const active = isActive(pathname, t.href);
        return (
          <Link key={t.label} href={t.href} data-tour={`tab:${t.label}`} aria-current={active ? "page" : undefined}
            className={cn(cls, active ? "text-ink-text-strong" : "text-ink-text/70")}>
            <t.icon size={20} strokeWidth={active ? 2.2 : 1.8} />
            {t.label}
          </Link>
        );
      })}
      <button type="button" onClick={openMenu} className={cn(cls, "text-ink-text/70")}>
        <Menu size={20} strokeWidth={1.8} />
        Menu
      </button>
    </nav>
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
  useEffect(() => { openRef.current = open; }, [open]);
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
      <div className="fixed inset-x-0 top-0 z-40 flex h-[calc(3.25rem+var(--sat))] items-center gap-3 bg-ink px-4 pb-2.5 pt-[calc(0.625rem+var(--sat))] print:hidden lg:hidden">
        <button onClick={() => setOpen(true)}
          className="flex h-9 items-center gap-1.5 rounded-md px-2 text-[14px] font-medium text-ink-text hover:bg-ink-2">
          <Menu size={20} /> Menu
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
          <button onClick={() => setOpen(false)}
            className="absolute right-3 top-[calc(0.875rem+var(--sat))] flex h-9 items-center gap-1 rounded-md px-2 text-[13px] font-medium text-ink-text hover:bg-ink-2">
            <X size={16} /> Close
          </button>
        </div>
      </div>
      <BottomTabs role={props.role} items={props.items} openMenu={() => setOpen(true)} />
      <ProductTour role={props.role} schoolName={props.schoolName} items={props.items} />
    </>
  );
}
