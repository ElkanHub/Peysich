import { CalendarDays } from "lucide-react";
import { getCurrentTerm } from "@/core/school-context";
import { todayIso, weekOfTerm } from "@/core/calendar";
import { greeting, pickHero, type HeroRole } from "@/lib/hero";

/** The top of every dashboard: a greeting by the time of day, who it is for,
 *  today's date and where the term stands, beside a photograph. The picture
 *  changes on reload — mostly the one for this person's role, sometimes one
 *  of the others. Text sits on the card colour, so it reads in both themes. */
export async function WelcomeHero({ role, name, title, line, schoolId }: {
  role: HeroRole; name: string; title: string; line: string; schoolId?: string;
}) {
  const term = schoolId ? await getCurrentTerm(schoolId) : null;
  const today = todayIso();
  const week = term ? weekOfTerm(term, today) : null;
  const date = new Date(today + "T12:00:00Z")
    .toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  // the chips: glass on the phone's photograph, paper on the desktop card
  const chip = "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[13px] font-medium " +
    "max-sm:border-white/25 max-sm:bg-white/15 max-sm:text-white max-sm:backdrop-blur-sm sm:border-border sm:bg-card/90";
  const pick = pickHero(role);

  /* Phone: the photograph IS the surface — full bleed, ink gradient, white
     text. Desktop: the photograph sits to the right of the words on the card. */
  return (
    <section className="relative mb-5 overflow-hidden rounded-xl border border-border bg-ink shadow-[var(--shadow-md)] sm:mb-6 sm:bg-card">
      {/* eslint-disable-next-line @next/next/no-img-element -- a decorative photograph, already sized and compressed */}
      <img src={`/hero/hero-${pick}-portrait.jpg`} alt="" aria-hidden loading="eager" decoding="async"
        className="absolute inset-0 h-full w-full object-cover object-[center_28%] sm:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/hero/${pick}.jpg`} alt="" aria-hidden loading="lazy" decoding="async"
        className="absolute inset-y-0 right-0 hidden h-full w-[64%] object-cover object-[center_30%] sm:block" />
      <div className="absolute inset-0 sm:hidden"
        style={{ background: "linear-gradient(180deg, rgb(26 18 24 / 0.08) 0%, rgb(26 18 24 / 0.35) 40%, rgb(26 18 24 / 0.9) 100%)" }} />
      <div className="absolute inset-0 hidden sm:block"
        style={{ background: "linear-gradient(90deg, var(--card) 0%, var(--card) 38%, color-mix(in srgb, var(--card) 55%, transparent) 54%, transparent 72%)" }} />
      <span aria-hidden className="absolute -left-10 top-1/2 hidden h-36 w-20 -translate-y-1/2 rounded-full bg-warning/25 sm:block" />
      <div className="relative max-w-xl px-4 pb-4 pt-32 text-white sm:px-9 sm:py-9 sm:text-foreground">
        <p className="font-mono text-[12px] font-medium uppercase tracking-[0.12em] text-[#e9a9c9] sm:text-muted-foreground">
          {greeting()}, {name.split(" ")[0]}
        </p>
        <h1 className="mt-1.5 text-[26px] font-bold leading-[1.1] tracking-[-0.03em] sm:mt-2 sm:text-[34px]">{title}</h1>
        <p className="mt-1.5 text-[14.5px] text-white/85 sm:mt-2 sm:text-[15px] sm:text-muted-foreground">{line}</p>
        <p className="chip-row mt-3.5 flex flex-wrap gap-2 sm:mt-4" data-nums="">
          <span className={chip}><CalendarDays size={14} className="text-[#e9a9c9] sm:text-primary" /> {date}</span>
          {term && <span className={chip}>{term.name}{term.year?.name ? ` · ${term.year.name}` : ""}</span>}
          {week?.current != null && week.current > 0 && week.current <= week.total && <span className={chip}>Week {week.current} / {week.total}</span>}
        </p>
      </div>
    </section>
  );
}
