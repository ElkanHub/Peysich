import { getCurrentTerm } from "@/core/school-context";
import { getHolidayMap, getSchoolHours, isWeekend, todayIso, weekOfTerm } from "@/core/calendar";
import { TermPulse } from "./term-pulse";

/** Server side of the dashboard strip: works out the week number, today's
 *  weekend/holiday status and the school-hours settings, then hands the
 *  live ticking to the client. */
export async function TermPulseBar({ school }: {
  school: { id: string; settings: unknown };
}) {
  const term = await getCurrentTerm(school.id);
  if (!term) return null;
  const [holidayMap] = await Promise.all([getHolidayMap(school.id)]);
  const hours = getSchoolHours(school.settings);
  const today = todayIso();
  const { current, total } = weekOfTerm(term, today);
  const day = new Date(today + "T12:00:00Z")
    .toLocaleDateString("en-GB", { weekday: "long" });
  const off = isWeekend(today)
    ? `${day} — no school on weekends`
    : holidayMap.has(today) ? `${holidayMap.get(today)} — no school today` : null;
  const fmt = (iso: string) =>
    new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const phase = today < term.startsAt ? `starts ${fmt(term.startsAt)}`
    : today > term.endsAt ? "ended" : null;

  return (
    <TermPulse termName={term.name} week={current} total={total} phase={phase}
      open={hours.open} close={hours.close} off={off} endsFmt={fmt(term.endsAt)} />
  );
}
