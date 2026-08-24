"use client";
import { useState } from "react";
import Image from "next/image";
import {
  CalendarCheck, GraduationCap, ClipboardList, Megaphone, CalendarRange,
  Check, type LucideIcon,
} from "lucide-react";

type Tab = {
  key: string; label: string; icon: LucideIcon; title: string; blurb: string;
  points: string[]; img: string; alt: string;
};

const TABS: Tab[] = [
  {
    key: "attendance", label: "Attendance", icon: CalendarCheck,
    title: "Registers in 30 seconds, kept like the GES book",
    blurb: "Everyone starts present — teachers tap only the exceptions. The year's record book builds itself.",
    points: [
      "Absence SMS reaches guardians the moment a register is saved",
      "A GES-style record book per class: weeks, day columns, term tallies",
      "Weekends and marked holidays never touch the records",
      "Admin corrections are tracked — cells are never edited in place",
    ],
    img: "/shots/record-book.png", alt: "The attendance record book, laid out like the GES register",
  },
  {
    key: "assessment", label: "Assessment", icon: GraduationCap,
    title: "Score sheets that convert as teachers type",
    blurb: "Name your class tests, set weights that must total 100, and watch raw marks convert live at every cell.",
    points: [
      "Per-section schemes — and a skills grid for preschool",
      "Submitted sheets lock; only an admin can reopen them",
      "Totals appear only when every column is in — no half-truths",
      "Completeness matrix shows exactly what's outstanding",
    ],
    img: "/shots/assessment.png", alt: "Assessment overview with per-class score sheet progress",
  },
  {
    key: "reports", label: "Reports", icon: ClipboardList,
    title: "Release each test on its own — families see only what you've sent",
    blurb: "Every release is tracked separately: what went out, when, and by whom. The terminal report locks the term.",
    points: [
      "Branded report cards — logo, motto, colours, signatures, your call",
      "Empty subjects stay on the paper as honest blank rows",
      "Preschool gets skills-based Learning & Development records",
      "Past terms and years stay browsable, read-only, forever",
    ],
    img: "/shots/reports.png", alt: "The Reports tab tracking each release separately",
  },
  {
    key: "comms", label: "Communication", icon: Megaphone,
    title: "Reach every parent — and know they saw it",
    blurb: "Announcements take the screen on app-open until acknowledged. Blasts go by SMS and email, signed with your school's name.",
    points: [
      "One feed: announcements, events and guardian blasts, each distinct",
      "Acknowledgements tracked per person, badge until it's read",
      "SMS + email blasts scoped strictly to your school's guardians",
      "Absence and fee reminders ride the same rails",
    ],
    img: "/shots/comms.png", alt: "The announcements feed with distinct card styles",
  },
  {
    key: "calendar", label: "Calendar & timetable", icon: CalendarRange,
    title: "The whole year at a glance, the whole week under control",
    blurb: "Term dates drive everything: week numbers, the calendar, the record book. Timetables come with clash detection built in.",
    points: [
      "Term opening and closing days flagged on a shared school calendar",
      "Holidays drop out of attendance and tallies automatically",
      "Four timetable views: class, teacher, subject and level",
      "Every dashboard shows Week N of the term and hours till closing",
    ],
    img: "/shots/calendar.png", alt: "The school calendar with term flags and holidays",
  },
];

/** The reference-style feature showcase: a tab rail and a live product
 *  screenshot per capability — the platform selling itself. */
export function FeatureTabs() {
  const [active, setActive] = useState(0);
  const tab = TABS[active];

  return (
    <div>
      <div role="tablist" aria-label="Platform features"
        className="flex flex-wrap justify-center gap-2">
        {TABS.map((tx, i) => {
          const Icon = tx.icon;
          const on = i === active;
          return (
            <button key={tx.key} role="tab" aria-selected={on}
              onClick={() => setActive(i)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[14px] font-medium transition-all
                ${on
                  ? "bg-primary text-primary-foreground shadow-[var(--shadow-md)]"
                  : "border border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground"}`}>
              <Icon size={15} />
              {tx.label}
            </button>
          );
        })}
      </div>

      <div className="mt-8 grid items-center gap-8 lg:grid-cols-[5fr_7fr] lg:gap-12">
        <div>
          <h3 className="text-[24px] font-semibold leading-snug tracking-tight">{tab.title}</h3>
          <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">{tab.blurb}</p>
          <ul className="mt-5 space-y-2.5">
            {tab.points.map((p2) => (
              <li key={p2} className="flex items-start gap-2.5 text-[14.5px] leading-snug">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                  <Check size={12} strokeWidth={3} />
                </span>
                {p2}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative">
          <div aria-hidden className="absolute -inset-4 rounded-3xl bg-[radial-gradient(closest-side,var(--brand-soft),transparent)] opacity-80" />
          <figure className="relative overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-lg)]">
            <div className="flex items-center gap-1.5 border-b border-border bg-muted/60 px-3.5 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-danger/50" />
              <span className="h-2.5 w-2.5 rounded-full bg-warning/50" />
              <span className="h-2.5 w-2.5 rounded-full bg-success/50" />
              <span className="ml-3 hidden rounded-md bg-card px-2.5 py-0.5 text-[11px] text-faint sm:block" data-nums="">
                stmarys.peysich.com
              </span>
            </div>
            <Image src={tab.img} alt={tab.alt} width={2040} height={1275}
              className="w-full" priority={false} />
          </figure>
        </div>
      </div>
    </div>
  );
}
