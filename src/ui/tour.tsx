"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CircleHelp, ArrowLeftRight, HelpCircle, LogOut, Menu as MenuIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { btnCls, btnGhostCls } from "@/ui/kit";
import { LogoMark } from "./logo";
import { groupNav, tabsFor, type NavEntry } from "./nav";

/* ── The walkthrough ────────────────────────────────────────────────────────
   Everything dims and ONE big card walks the person through the app, one
   stop at a time. Each stop has a note on the right and, on the left, a
   drawing of the screen — this person's real menu (module off → not drawn,
   tab not granted → not drawn) with the stop's control lit, and the page
   element the note talks about. Nothing follows the live UI around, so it
   cannot drift, cover the thing it points at, or break on a phone.

   Scripts are per role and describe what the app does TODAY. A stop whose
   menu item this person does not have is dropped, so the count is honest.

   Seen-state lives in localStorage per role — a new device offers the walk
   again, which is the friendly failure mode. Help in the menu re-opens it. */

type Callout = { label: string; kind: "search" | "button" | "rows" | "cards" | "form" | "list" | "banner" };
type Step = {
  title: string; body: string;
  /** menu item to light; the stop is dropped if this person's menu lacks it */
  nav?: string;
  /** a page control to draw and label */
  callout?: Callout;
  /** light the menu footer (Help / Switch account / Sign out) instead of an item */
  footer?: boolean;
  /** how to get there, in words (defaults to "Menu → {nav}") */
  path?: string;
};

const SCRIPTS: Record<string, Step[]> = {
  admin: [
    { nav: "Home", title: "Home: the school at a glance",
      body: "Which registers are marked, money in and still owed, and which score sheets are still missing — with a Remind button beside each. Until setup is finished, Home is a checklist that ticks itself.",
      callout: { label: "Scores still missing · Remind the teacher", kind: "cards" } },
    { nav: "School settings", title: "Setting up, in order", path: "Menu → School settings",
      body: "Term dates first, then tick the classes you have (subjects are created for you), enter this term's fees, add your teachers, pick your colour and crest. The checklist on Home ticks each one as you go.",
      callout: { label: "Classes · The school day · How marks become grades · People who help run the school", kind: "list" } },
    { nav: "Students", title: "Adding children", path: "Menu → Students → Add a student",
      body: "One screen, five things: first name, last name, boy or girl, class, and a parent's name and phone. Everything else waits under “Add more details” on the child's page. Whole school at once? Import from a sheet.",
      callout: { label: "Add a student · Import from a sheet", kind: "form" } },
    { nav: "Attendance", title: "Who has marked the register",
      body: "Unmarked classes sit at the top with the teacher's name and a Remind button. You can mark a register yourself, and correct a past day from the record book.",
      callout: { label: "Remind Sir Kwame · Mark it myself", kind: "rows" } },
    { nav: "Fees", title: "Recording money that comes in", path: "Menu → Fees → type the child's name",
      body: "Parents pay the school directly — MoMo to the school's number or cash at the office — and you record it here. Type the child's name, the amount is already filled in, tap Save payment. A receipt prints and an SMS goes to the parent.",
      callout: { label: "Who is paying? Type the child's name.", kind: "search" } },
    { nav: "Report cards", title: "Sending report cards home", path: "Menu → Report cards",
      body: "The page says which classes are ready. One button sends the term's report cards to every parent; it asks first, names any class that is not fully marked, and locks the scores after. Tests can be sent early the same way.",
      callout: { label: "Send report cards to parents", kind: "button" } },
    { nav: "Announcements", title: "Reaching every parent", path: "Menu → Announcements",
      body: "A notice goes to the app and shows a red number until it is read. Text all parents sends an SMS; it shows the count and the cost before you confirm.",
      callout: { label: "Text all parents · 92 characters · 1 SMS each", kind: "form" } },
    { nav: "Timetable", title: "The week without clashes",
      body: "Tap an empty box, tap a subject; the panel moves to the next empty box. If a teacher is already somewhere else at that time, the box turns red and says where.",
      callout: { label: "Add · Sir Kwame is in JHS 1 then", kind: "cards" } },
    { nav: "Staff", title: "Teachers and who teaches what", path: "Menu → Staff",
      body: "Add a teacher with a name, a phone and what they do; their login goes by SMS. “Who teaches which class” is where a class gets its class teacher, whose name and signature go on that class's papers.",
      callout: { label: "Add staff · Who teaches which class", kind: "rows" } },
    { footer: true, title: "Help, switching, signing out", path: "Menu → bottom",
      body: "Help opens this walk again. Switch account is for a person with two logins on one phone. Sign out clears the pages saved for offline on this device.",
      callout: { label: "Help · Switch account · Sign out", kind: "banner" } },
  ],
  teacher: [
    { nav: "Home", title: "Your day, not paperwork",
      body: "Only your classes. Your register tile says Mark register or Register saved. Reminders from the office show here until the thing is done.",
      callout: { label: "Basic 4 A · Mark register →", kind: "cards" } },
    { nav: "Attendance", title: "The register in 30 seconds", path: "Register tab, or Menu → Attendance",
      body: "Every child starts Present. Tap Absent or Late only for the exceptions, then Save. The button says how many parents will get an SMS. No signal? It saves on the phone and sends itself later.",
      callout: { label: "Present · Absent · Late   Save register · 3 absent", kind: "rows" } },
    { nav: "Scores", title: "Entering marks", path: "Scores tab, or Menu → Scores",
      body: "Tap the class and subject. Start a test by saying what it was marked out of, then type marks down the column — Enter moves to the next pupil and every mark saves itself. Lock the test when it is complete.",
      callout: { label: "This test was marked out of ___ · Start", kind: "form" } },
    { nav: "Homework", title: "Homework parents can see", path: "Homework tab",
      body: "Type it, it is due tomorrow for the class you used last time, tap Give homework. Hand-ins arrive here with a Save mark button.",
      callout: { label: "Give homework", kind: "button" } },
    { nav: "Announcements", title: "Telling your class something", path: "Menu → Announcements",
      body: "Write a notice; it goes to the parents of your class and shows a red number until they read it.",
      callout: { label: "Write a notice", kind: "form" } },
    { footer: true, title: "Your signature, and Help", path: "Menu → My account",
      body: "Draw your signature once under My account and it goes on every report card you sign. Help at the bottom of the menu opens this walk again; Switch account is for a teacher who is also a parent.",
      callout: { label: "Help · Switch account · Sign out", kind: "banner" } },
  ],
  parent: [
    { nav: "Home", title: "Your children, on one card each", path: "My children tab",
      body: "Was my child in school today? What do I owe? Each card answers both in words, with How to pay and Report card as its two buttons.",
      callout: { label: "✓ In school today · Owing GHS 250 · How to pay · Report card", kind: "cards" } },
    { nav: "Fees", title: "Paying the school", path: "Fees tab, or How to pay on the card",
      body: "You pay the school itself: MoMo to the school's number (the page shows it, with the name to confirm before you send) or cash at the office. When the office records it, the card updates and a receipt SMS arrives. Receipts stay here forever.",
      callout: { label: "How to pay · school MoMo number · office hours", kind: "banner" } },
    { nav: "Attendance", title: "Was my child in school?",
      body: "The register, day by day. If your child is marked absent, you already have the SMS.",
      callout: { label: "Mon ✓ · Tue ✓ · Wed absent · Thu ✓", kind: "rows" } },
    { nav: "Announcements", title: "Notices from the school", path: "Notices tab",
      body: "A red number means something is unread. Tap Seen at the bottom once you have read it. Report cards and test results appear on your child's page the moment the school sends them.",
      callout: { label: "Seen", kind: "list" } },
    { footer: true, title: "Help, and two accounts on one phone", path: "Menu → bottom",
      body: "Help opens this walk again. If you are also a teacher here, Switch account moves between the two without typing your name again.",
      callout: { label: "Help · Switch account · Sign out", kind: "banner" } },
  ],
  student: [
    { nav: "Home", title: "Today", path: "Today tab",
      body: "Your next lessons, homework that is due (overdue in red at the top), and new notices — in the order your day needs them.",
      callout: { label: "Do today · Hand in: Maths · was due Monday", kind: "list" } },
    { nav: "Homework", title: "Handing in", path: "Homework tab",
      body: "Tap the homework, take a photo of your work or choose a file, wait for “Photo attached ✓”, then Hand in. It stays grey until something is attached, so nothing is handed in empty.",
      callout: { label: "Take a photo of your work · Hand in", kind: "form" } },
    { nav: "Home", title: "Results", path: "Results tab",
      body: "When the school sends a test or the term's report card, it shows up under My results, subject by subject, with the teacher's comment.",
      callout: { label: "My results this term →", kind: "list" } },
    { nav: "Announcements", title: "Notices", path: "Menu → Announcements",
      body: "What the school has said. Read it here so nobody has to chase you.",
      callout: { label: "Seen", kind: "list" } },
  ],
};

const seenKey = (role: string) => `schoolspec-tour-done:${role}`;

/* phone or desktop drawing — decided by the real viewport, subscribed not polled */
const mq = () => window.matchMedia("(max-width: 1023px)");
const subscribeMobile = (cb: () => void) => { const m = mq(); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };
const useIsMobile = () => useSyncExternalStore(subscribeMobile, () => mq().matches, () => false);

/* ── the drawing ─────────────────────────────────────────────────────────── */

function Callout({ c, title }: { c: Callout; title: string }) {
  const ring = "ring-2 ring-primary ring-offset-2 ring-offset-card";
  const tag = (
    <span className="absolute -top-2.5 left-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold leading-none text-primary-foreground">
      here
    </span>
  );
  const line = "h-2 rounded bg-border";
  const box = "relative rounded-lg border border-border bg-card p-2";
  switch (c.kind) {
    case "search": return (
      <div className={cn(box, ring, "flex h-10 items-center px-3 text-[11.5px] text-muted-foreground")}>{tag}{c.label}</div>);
    case "button": return (
      <div className="relative inline-flex">
        {tag}<span className={cn("rounded-full bg-primary px-3.5 py-2 text-[11.5px] font-semibold text-primary-foreground", ring)}>{c.label}</span>
      </div>);
    case "banner": return (
      <div className={cn(box, ring, "bg-brand-soft text-[11.5px] font-medium text-foreground")}>{tag}{c.label}</div>);
    case "rows": return (
      <div className={cn(box, ring, "space-y-1.5")}>{tag}
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="h-4 w-4 rounded-full bg-brand-container" />
            <span className={cn(line, "w-16")} />
            <span className="ml-auto flex gap-1">
              <span className={cn("h-3.5 w-6 rounded-full", i === 1 ? "bg-danger" : "bg-success")} />
              <span className="h-3.5 w-6 rounded-full bg-border" />
            </span>
          </div>
        ))}
        <p className="pt-1 text-[10.5px] font-medium text-primary">{c.label}</p>
      </div>);
    case "cards": return (
      <div className={cn(box, ring, "grid grid-cols-2 gap-1.5")}>{tag}
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-md border border-border p-1.5">
            <span className={cn(line, "block w-12")} /><span className={cn(line, "mt-1 block w-8 opacity-60")} />
          </div>
        ))}
        <p className="col-span-2 text-[10.5px] font-medium text-primary">{c.label}</p>
      </div>);
    case "form": return (
      <div className={cn(box, ring, "space-y-1.5")}>{tag}
        {[0, 1].map((i) => <div key={i} className="h-5 rounded-md border border-border bg-background" />)}
        <span className="inline-block rounded-full bg-primary px-3 py-1 text-[10.5px] font-semibold text-primary-foreground">{c.label}</span>
      </div>);
    case "list": return (
      <div className={cn(box, ring, "space-y-1.5")}>{tag}
        {[0, 1, 2].map((i) => <span key={i} className={cn(line, "block", ["w-5/6", "w-2/3", "w-3/4"][i])} />)}
        <p className="text-[10.5px] font-medium text-primary">{c.label}</p>
      </div>);
  }
  void title;
}

function Menu({ items, lit, footerLit, compact }: { items: NavEntry[]; lit?: string; footerLit?: boolean; compact?: boolean }) {
  // a long menu (20 items for an admin) is taller than the drawing: keep the
  // lit item in view, the way the real menu scrolls
  const litRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = litRef.current, list = listRef.current;
    if (!list) return;
    if (footerLit || !el) { list.scrollTop = footerLit ? list.scrollHeight : 0; return; }
    list.scrollTop = Math.max(0, el.offsetTop - list.clientHeight / 2 + el.offsetHeight / 2);
  }, [lit, footerLit]);
  return (
    <div className="flex h-full flex-col bg-ink text-ink-text">
      <div className="flex items-center gap-1.5 px-2.5 pt-2.5 text-[10px] font-semibold text-ink-text-strong">
        <LogoMark size={12} variant="light" /> Menu
      </div>
      <div ref={listRef} className={cn("relative flex-1 overflow-hidden px-1.5 pt-1.5", compact ? "text-[9px]" : "text-[10px]")}>
        {groupNav(items).map(([g, ls]) => (
          <div key={g || "core"} className="mb-1">
            {g && <p className="px-1.5 pb-0.5 font-mono text-[7.5px] uppercase tracking-wider text-ink-text/50">{g}</p>}
            {ls.map((n) => (
              <div key={n.label} ref={lit === n.label ? litRef : undefined}
                className={cn("relative my-px flex h-4 items-center rounded-full px-1.5 leading-none",
                lit === n.label ? "bg-ink-active font-bold text-ink-text-strong ring-2 ring-primary" : "")}>
                {n.label}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className={cn("grid grid-cols-2 gap-x-1 gap-y-0.5 px-2 pb-2 pt-1 text-[8.5px] leading-none",
        footerLit && "rounded-md ring-2 ring-primary")}>
        <span className="flex items-center gap-1"><LogOut size={8} /> Sign out</span>
        <span className="flex items-center gap-1"><ArrowLeftRight size={8} /> Switch account</span>
        <span className="flex items-center gap-1"><HelpCircle size={8} /> Help</span>
        <span>Dark</span>
      </div>
    </div>
  );
}

/** The screen as this person sees it, with the stop lit. */
function Screen({ step, items, role, schoolName, mobile }: {
  step: Step; items: NavEntry[]; role: string; schoolName: string; mobile: boolean;
}) {
  const pageTitle = step.nav ?? "Home";
  const page = (
    <div className="flex-1 bg-background p-2.5">
      <p className="text-[11px] font-bold text-foreground">{pageTitle}</p>
      <span className="mt-1 block h-1.5 w-1/2 rounded bg-border" />
      <div className="mt-3">
        {step.callout ? <Callout c={step.callout} title={step.title} /> : (
          <div className="grid grid-cols-2 gap-1.5">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-9 rounded-md border border-border bg-card" />)}
          </div>
        )}
      </div>
    </div>
  );

  if (!mobile) {
    return (
      <div className="flex aspect-[4/3] w-full overflow-hidden rounded-xl border border-border shadow-[var(--shadow-md)]">
        <div className="w-[34%] shrink-0"><Menu items={items} lit={step.nav} footerLit={step.footer} /></div>
        {page}
      </div>
    );
  }

  // phone: a bottom tab lights when the stop is a tab; otherwise the Menu tab
  // lights and the drawer is drawn open with the item lit
  const tabs = tabsFor(role, items);
  const tabFor: Record<string, string> = { Attendance: "Register", Scores: "Scores", Homework: "Homework", Home: role === "parent" ? "My children" : role === "student" ? "Today" : "Home", Fees: "Fees", Announcements: "Notices" };
  const litTab = step.nav && tabs.includes(tabFor[step.nav] ?? step.nav) ? (tabFor[step.nav] ?? step.nav) : null;
  const drawer = !litTab;
  return (
    <div className="relative mx-auto flex aspect-[9/16] w-[62%] max-w-[230px] flex-col overflow-hidden rounded-[18px] border-[3px] border-ink shadow-[var(--shadow-md)]">
      <div className="flex h-7 items-center gap-1.5 bg-ink px-2 text-[9px] font-semibold text-ink-text-strong">
        <MenuIcon size={10} /> Menu <span className="truncate opacity-80">· {schoolName}</span>
      </div>
      <div className="relative flex flex-1 overflow-hidden">
        {page}
        {drawer && (
          <div className="absolute inset-0 bg-black/40">
            <div className="h-full w-[78%]"><Menu items={items} lit={step.nav} footerLit={step.footer} compact /></div>
          </div>
        )}
      </div>
      <div className="flex h-9 items-stretch border-t border-ink-border bg-ink px-0.5 text-[8px] font-medium text-ink-text/70">
        {tabs.map((t) => (
          <span key={t} className={cn("flex flex-1 flex-col items-center justify-center rounded-md leading-none",
            litTab === t && "bg-ink-active text-ink-text-strong ring-2 ring-primary")}>
            <span className="mb-0.5 h-2.5 w-2.5 rounded-sm bg-current opacity-60" />{t}
          </span>
        ))}
        <span className={cn("flex flex-1 flex-col items-center justify-center rounded-md leading-none",
          drawer && "bg-ink-active text-ink-text-strong ring-2 ring-primary")}>
          <MenuIcon size={10} className="mb-0.5" />Menu
        </span>
      </div>
    </div>
  );
}

/* ── the card ────────────────────────────────────────────────────────────── */

export function ProductTour({ role, schoolName, items }: { role: string; schoolName: string; items: NavEntry[] }) {
  const script = SCRIPTS[role];
  const mobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0); // 0 = welcome, then steps[i - 1]

  // only stops this person can actually reach
  const have = new Set(items.map((n) => n.label));
  const steps = (script ?? []).filter((s) => s.footer || (s.nav && have.has(s.nav)));

  const start = useCallback(() => { setI(0); setOpen(true); }, []);
  const finish = useCallback(() => {
    setOpen(false);
    try { localStorage.setItem(seenKey(role), new Date().toISOString()); } catch { /* fine */ }
  }, [role]);

  // first sign-in on this device → offer the walk; Help re-opens it any time
  useEffect(() => {
    if (!script) return;
    let stored = "1";
    try { stored = localStorage.getItem(seenKey(role)) ?? localStorage.getItem(`peysich-tour-done:${role}`) ?? ""; } catch { /* private mode */ }
    if (!stored) { const t = setTimeout(start, 700); return () => clearTimeout(t); }
  }, [role, script, start]);
  useEffect(() => {
    window.addEventListener("schoolspec:tour", start);
    return () => window.removeEventListener("schoolspec:tour", start);
  }, [start]);

  // the document knows a walk is running, so other on-open notices (the
  // announcement gate) wait their turn instead of stacking on top
  useEffect(() => {
    document.documentElement.toggleAttribute("data-tour", open);
    if (!open) window.dispatchEvent(new Event("schoolspec:tour-end"));
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") setI((n) => Math.min(n + 1, steps.length));
      if (e.key === "ArrowLeft") setI((n) => Math.max(n - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, finish, steps.length]);

  if (!open || !script || steps.length === 0) return null;

  const welcome = i === 0;
  const step = welcome ? null : steps[i - 1];
  const last = i === steps.length;
  const drawn: Step = step ?? { title: "", body: "", nav: undefined };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
      role="dialog" aria-modal="true" aria-label={welcome ? "Welcome" : step?.title} onClick={finish}>
      <div className="flex max-h-[96dvh] w-full max-w-[1000px] flex-col overflow-hidden rounded-t-2xl bg-card shadow-[var(--shadow-lg)] sm:rounded-2xl md:flex-row"
        onClick={(e) => e.stopPropagation()}>
        {/* the picture */}
        <div className="flex shrink-0 items-center justify-center bg-muted p-4 md:w-[52%] md:p-6">
          <Screen step={drawn} items={items} role={role} schoolName={schoolName} mobile={mobile} />
        </div>
        {/* the note */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5 md:p-7">
          {welcome ? (
            <>
              <LogoMark size={36} />
              <h2 className="mt-4 text-[22px] font-bold leading-snug">Welcome to {schoolName}</h2>
              <p className="mt-2 text-[16px] leading-relaxed text-muted-foreground">
                {steps.length} short stops show where everything is and how to get there. The picture on the
                {mobile ? " top" : " left"} is your own menu. Stop any time; <b>Help</b> at the bottom of the menu brings this back.
              </p>
            </>
          ) : (
            <>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">Stop {i} of {steps.length}</p>
              <h2 className="mt-1.5 text-[21px] font-bold leading-snug">{step!.title}</h2>
              <p className="mt-1 text-[14px] font-medium text-muted-foreground">
                Where: {step!.path ?? `Menu → ${step!.nav}`}
              </p>
              <p className="mt-3 text-[16px] leading-relaxed text-foreground/90">{step!.body}</p>
            </>
          )}
          <div className="mt-auto flex items-center justify-between gap-3 pt-6">
            <div className="flex gap-1.5" aria-hidden>
              {Array.from({ length: steps.length + 1 }, (_, d) => (
                <i key={d} className={cn("h-1.5 rounded-full transition-all", d === i ? "w-5 bg-primary" : "w-1.5 bg-border-strong")} />
              ))}
            </div>
            <div className="flex items-center gap-2">
              {i > 0 && (
                <button type="button" onClick={() => setI(i - 1)} className={cn(btnGhostCls, "h-11 px-4 text-[15px]")}>Back</button>
              )}
              <button type="button" onClick={() => (last ? finish() : setI(i + 1))} className={cn(btnCls, "h-11 px-5 text-[15px]")}>
                {welcome ? "Show me" : last ? "Done ✓" : "Next"}
              </button>
            </div>
          </div>
          <button type="button" onClick={finish} className="mt-3 self-start text-[14px] font-medium text-muted-foreground hover:text-foreground">
            {welcome ? "I'll explore on my own" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** The menu-footer relaunch, with its word. */
export function TourRelaunch() {
  return (
    <button type="button" title="Show me around again"
      onClick={() => window.dispatchEvent(new Event("schoolspec:tour"))}
      className="flex h-8 items-center gap-1.5 text-[12px] font-medium text-ink-text/60 transition-colors hover:text-ink-text-strong">
      <CircleHelp size={12} /> Help
    </button>
  );
}
