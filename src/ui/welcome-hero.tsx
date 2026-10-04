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
  const chip = "inline-flex items-center gap-1.5 rounded-md border border-border bg-card/90 px-2.5 py-1 text-[13px] font-medium";

  return (
    <section className="relative mb-6 overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-md)]">
      {/* eslint-disable-next-line @next/next/no-img-element -- a decorative photograph, already sized and compressed */}
      <img src={`/hero/${pickHero(role)}.jpg`} alt="" aria-hidden
        className="absolute inset-y-0 right-0 hidden h-full w-[64%] object-cover object-[center_30%] sm:block" />
      <div className="absolute inset-0 hidden sm:block"
        style={{ background: "linear-gradient(90deg, var(--card) 0%, var(--card) 38%, color-mix(in srgb, var(--card) 55%, transparent) 54%, transparent 72%)" }} />
      <span aria-hidden className="absolute -left-10 top-1/2 h-36 w-20 -translate-y-1/2 rounded-full bg-warning/25" />
      <div className="relative max-w-xl px-6 py-7 sm:px-9 sm:py-9">
        <p className="font-mono text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {greeting()}, {name.split(" ")[0]}
        </p>
        <h1 className="mt-2 text-[26px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-[34px]">{title}</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">{line}</p>
        <p className="mt-4 flex flex-wrap gap-2" data-nums="">
          <span className={chip}><CalendarDays size={14} className="text-primary" /> {date}</span>
          {term && <span className={chip}>{term.name}{term.year?.name ? ` · ${term.year.name}` : ""}</span>}
          {week?.current != null && week.current > 0 && week.current <= week.total && <span className={chip}>Week {week.current} / {week.total}</span>}
        </p>
      </div>
    </section>
  );
}
