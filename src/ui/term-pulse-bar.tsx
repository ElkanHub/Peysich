import Link from "next/link";
import { getCurrentTerm } from "@/core/school-context";
import { getHolidayMap, getSchoolHours, isWeekend, todayIso, weekOfTerm } from "@/core/calendar";
import { addDays, CORRECTION_DAYS, listTerms, schoolWritable } from "@/core/terms";
import { closeTermAction, openTermAction } from "@/app/s/[school]/term-actions";
import { SubmitButton } from "./feedback";
import { btnCls, btnGhostCls } from "./kit";
import { TermPulse } from "./term-pulse";

/** Server side of the dashboard strip: works out the week number, today's
 *  weekend/holiday status and the school-hours settings, then hands the
 *  live ticking to the client. Between terms it carries the ceremony: close
 *  the ended term, open the next one early (admins only). */
export async function TermPulseBar({ school, slug, admin }: {
  school: { id: string; status: string; settings: unknown }; slug: string; admin?: boolean;
}) {
  const term = await getCurrentTerm(school.id);
  if (!term) return null;
  const [holidayMap, all] = await Promise.all([getHolidayMap(school.id), listTerms(school.id)]);
  const hours = getSchoolHours(school.settings);
  const today = todayIso();
  const { current, total } = weekOfTerm(term, today);
  const day = new Date(today + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long" });
  const off = isWeekend(today)
    ? `${day} — no school on weekends`
    : holidayMap.has(today) ? `${holidayMap.get(today)} — no school today` : null;
  const fmt = (iso: string) =>
    new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const next = [...all].reverse().find((t) => t.state === "upcoming");
  const phase = term.state === "open" ? null
    : term.state === "upcoming" ? `starts ${fmt(term.startsAt)}`
    : term.state === "closed" ? `closed${next ? ` · ${next.name} starts ${fmt(next.startsAt)}` : ""}`
    : `ended ${fmt(term.endsAt)}${next ? ` · ${next.name} starts ${fmt(next.startsAt)}` : ""}`;
  const overdue = term.state === "ended" && today > addDays(term.endsAt, CORRECTION_DAYS);
  const canOpen = admin && schoolWritable(school.status) && next && (term.state === "closed" || term.state === "upcoming");

  return (
    <TermPulse termName={term.name} week={current} total={total} phase={phase}
      open={hours.open} close={hours.close} off={off} endsFmt={fmt(term.endsAt)}
      warn={overdue ? `Still open ${CORRECTION_DAYS} days after its last day` : null}>
      {admin && term.state === "ended" && (
        <form action={closeTermAction.bind(null, slug, term.id)} className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
            <input type="checkbox" name="anyway" /> close anyway
          </label>
          <SubmitButton className={btnCls + " h-8 px-3.5 text-[13px]"} pendingText="Closing…">Close {term.name}</SubmitButton>
        </form>
      )}
      {canOpen && (
        <form action={openTermAction.bind(null, slug, next.id)}>
          <SubmitButton className={btnCls + " h-8 px-3.5 text-[13px]"} pendingText="Opening…">
            Open {next.name}{next.startsAt > today ? " early" : ""}
          </SubmitButton>
        </form>
      )}
      {admin && term.state === "closed" && !next && (
        <Link href="/settings/promotion" className={btnGhostCls + " h-8 px-3.5 text-[13px]"}>Close the year</Link>
      )}
    </TermPulse>
  );
}
