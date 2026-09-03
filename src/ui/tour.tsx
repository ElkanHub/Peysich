"use client";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { btnCls } from "@/ui/kit";
import { LogoMark } from "./logo";

/* ── Product tour ───────────────────────────────────────────────────────────
   A spotlight walkthrough in the Google style: the app dims, one REAL
   control at a time stays lit, and a small card explains it. Anchored to
   the live UI via data-tour attributes (never screenshots, so it can't
   drift), written per role, skippable at every moment, Esc closes.
   ~No library: scrim + a box-shadow cutout + getBoundingClientRect.

   Seen-state lives in localStorage per role — instant, no migration; a new
   device offers the tour again, which is the friendly failure mode.     */

type Step = { anchor: string; title: string; body: string };

const SCRIPTS: Record<string, Step[]> = {
  admin: [
    { anchor: "Dashboard", title: "Your day at a glance", body: "Attendance, money in, money owed — the numbers a head checks before the first bell, live on the dashboard." },
    { anchor: "Students", title: "Every child lives here", body: "The student file holds the profile, guardians, fees and report cards — one page per job, nothing buried." },
    { anchor: "Attendance", title: "The 30-second register", body: "Everyone starts present; teachers tap only the exceptions. The GES-style record book writes itself." },
    { anchor: "Fees", title: "The money desk", body: "Invoices, receipts and reminders. A red dot on a child means owing — it clears the moment the balance does." },
    { anchor: "Reports", title: "Papers that print themselves", body: "Report cards under your school's colour and crest, signed by the right person automatically." },
    { anchor: "Timetable", title: "The week, without clashes", body: "Drag lessons into place — double-bookings are caught before they happen." },
    { anchor: "Settings", title: "Make it yours", body: "Your classes, your colours, your team, your signatures — everything a school sets once lives here." },
  ],
  teacher: [
    { anchor: "Dashboard", title: "Your day, not paperwork", body: "Only your classes and your lessons — scoped to exactly what you teach." },
    { anchor: "Attendance", title: "The 30-second register", body: "Everyone starts present; tap only the exceptions. Guardians of absentees get an SMS instantly." },
    { anchor: "Assessment", title: "Score sheets that add up", body: "Enter scores, and totals, grades and positions compute themselves on the school's own scheme." },
    { anchor: "Homework", title: "Homework parents can see", body: "Post it once — every parent in the class sees it, with the due date." },
    { anchor: "Account", title: "Your signature, once", body: "Draw or upload it here and it appears on every report card you sign — no admin needed." },
  ],
  parent: [
    { anchor: "Dashboard", title: "Your children, only yours", body: "Each child's day — attendance, homework and notices — strictly scoped to your family." },
    { anchor: "Attendance", title: "Was my child in school?", body: "The register, day by day. If a child is marked absent you'll already have the SMS." },
    { anchor: "Fees", title: "Fees & receipts", body: "What's owed and what's paid, with mobile-money payment from any phone and receipts kept forever." },
    { anchor: "Reports", title: "Report cards, released", body: "The moment the school releases results, they're here — printed beautifully if you want paper." },
  ],
};

const seenKey = (role: string) => `peysich-tour-done:${role}`;

function visibleAnchor(anchor: string): DOMRect | null {
  const els = document.querySelectorAll(`[data-tour="${anchor}"]`);
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && r.left > -40 && r.left < window.innerWidth) return r;
  }
  return null;
}

export function ProductTour({ role, schoolName, setDrawerOpen }: {
  role: string; schoolName: string; setDrawerOpen: (open: boolean) => void;
}) {
  const script = SCRIPTS[role];
  const [phase, setPhase] = useState<"idle" | "welcome" | "steps">("idle");
  const [i, setI] = useState(0);
  const [steps, setSteps] = useState<Step[]>([]);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // First sign-in on this device → offer the walk. The ? button re-offers it.
  useEffect(() => {
    if (!script) return;
    let stored = "1";
    try { stored = localStorage.getItem(seenKey(role)) ?? ""; } catch { /* private mode */ }
    if (!stored) {
      const t = setTimeout(() => setPhase("welcome"), 700);
      return () => clearTimeout(t);
    }
  }, [role, script]);
  useEffect(() => {
    const relaunch = () => { if (script) setPhase("welcome"); };
    window.addEventListener("peysich:tour", relaunch);
    return () => window.removeEventListener("peysich:tour", relaunch);
  }, [script]);

  const finish = useCallback(() => {
    setPhase("idle");
    setRect(null);
    if (window.innerWidth < 1024) setDrawerOpen(false);
    try { localStorage.setItem(seenKey(role), new Date().toISOString()); } catch { /* fine */ }
  }, [role, setDrawerOpen]);

  const begin = () => {
    // Only stops whose control is actually on this person's nav.
    const mobile = window.innerWidth < 1024;
    if (mobile) setDrawerOpen(true);
    setTimeout(() => {
      const present = (script ?? []).filter((s) => visibleAnchor(s.anchor));
      if (present.length === 0) { finish(); return; }
      setSteps(present); setI(0); setPhase("steps");
    }, mobile ? 340 : 0); // wait for the drawer's own motion first
  };

  // Position tracking: measure on step change, resize and scroll.
  useEffect(() => {
    if (phase !== "steps" || !steps[i]) return;
    const measure = () => setRect(visibleAnchor(steps[i].anchor));
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => { window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [phase, steps, i]);

  useEffect(() => {
    if (phase === "idle") return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") finish(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, finish]);

  if (phase === "idle" || !script) return null;

  if (phase === "welcome") {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-5"
        role="dialog" aria-modal="true" aria-label="Welcome tour">
        <div className="w-full max-w-md rounded-2xl bg-card p-7 shadow-lg">
          <LogoMark size={40} />
          <h2 className="mt-4 text-[21px] font-semibold leading-snug">Welcome to {schoolName} on Peysich</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            A two-minute walk shows you where everything lives. You can stop anytime — and take it
            again from the <b>?</b> in the sidebar.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <button type="button" className={btnCls} onClick={begin}>Show me around</button>
            <button type="button" onClick={finish}
              className="px-2 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
              I&apos;ll explore on my own
            </button>
          </div>
          <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {script.length} quick stops
          </p>
        </div>
      </div>
    );
  }

  const step = steps[i];
  const last = i === steps.length - 1;
  const mobile = typeof window !== "undefined" && window.innerWidth < 1024;
  const pad = 6;
  const spot = rect ? {
    left: rect.left - pad, top: rect.top - pad,
    width: rect.width + pad * 2, height: rect.height + pad * 2,
  } : null;
  // Coachmark rides beside the spotlight on desktop; docks as a sheet on phones.
  const coachStyle: React.CSSProperties = mobile || !spot
    ? { left: 12, right: 12, bottom: 16 }
    : {
        left: Math.min(spot.left + spot.width + 16, window.innerWidth - 312),
        top: Math.min(Math.max(12, spot.top), window.innerHeight - 210),
      };

  return (
    <div className="fixed inset-0 z-[60]" aria-live="polite">
      {/* click-catcher only — the dimming is four rectangles framing the lit
          control (huge box-shadow spreads don't rasterize in Chromium), so
          the control itself stays at full brightness */}
      <div className="absolute inset-0" onClick={() => {}} />
      {spot && (() => {
        const dim = "rgba(10,6,10,.62)";
        const ease = "all 340ms cubic-bezier(.2,0,0,1)";
        const r = { left: 0, right: 0, width: "100%" } as const;
        return (
          <div aria-hidden="true" className="pointer-events-none">
            <div className="fixed" style={{ ...r, top: 0, height: Math.max(0, spot.top), background: dim, transition: ease }} />
            <div className="fixed" style={{ left: 0, top: spot.top, width: Math.max(0, spot.left), height: spot.height, background: dim, transition: ease }} />
            <div className="fixed" style={{ left: spot.left + spot.width, top: spot.top, right: 0, height: spot.height, background: dim, transition: ease }} />
            <div className="fixed" style={{ ...r, top: spot.top + spot.height, bottom: 0, background: dim, transition: ease }} />
            <div data-spot="" className="fixed rounded-[14px] border-2 border-white/85 shadow-md"
              style={{ ...spot, transition: ease }} />
          </div>
        );
      })()}
      <div className="fixed w-auto max-w-[300px] rounded-2xl bg-card p-4 shadow-lg sm:w-[300px]"
        style={{ ...coachStyle, transition: "all 340ms cubic-bezier(.2,0,0,1)" }}
        role="dialog" aria-label={step?.title}>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-primary">
          Step {i + 1} of {steps.length}
        </p>
        <p className="mt-1 text-[15px] font-semibold">{step?.title}</p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">{step?.body}</p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex gap-1.5">
            {steps.map((_, d) => (
              <i key={d} className={cn("h-1.5 rounded-full transition-all",
                d === i ? "w-4 bg-primary" : "w-1.5 bg-border-strong")} />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {i > 0 && (
              <button type="button" onClick={() => setI(i - 1)}
                className="rounded-full px-3 py-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground">
                Back
              </button>
            )}
            <button type="button" onClick={() => (last ? finish() : setI(i + 1))}
              className="rounded-full bg-primary px-3.5 py-1.5 text-[13px] font-semibold text-primary-foreground hover:opacity-90">
              {last ? "Done ✓" : "Next"}
            </button>
          </div>
        </div>
        <button type="button" onClick={finish}
          className="mt-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground">
          Skip the tour
        </button>
      </div>
    </div>
  );
}

/** The sidebar-footer relaunch: small, always there, never in the way. */
export function TourRelaunch() {
  return (
    <button type="button" aria-label="Take the tour again"
      onClick={() => window.dispatchEvent(new Event("peysich:tour"))}
      className="flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-semibold text-ink-text/70 hover:bg-ink-2 hover:text-ink-text-strong">
      ?
    </button>
  );
}
