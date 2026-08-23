import Link from "next/link";
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { CalendarRange, ChevronLeft, ChevronRight, Flag, PartyPopper } from "lucide-react";
import { db } from "@/db";
import { events, holidays, terms, academicYears, classes } from "@/db/schema";
import { requireModule, getCurrentTerm } from "@/core/school-context";
import { getParentChildren, getStudentSelf } from "@/core/portal";
import { addCalendarEvent, addHoliday, removeHoliday } from "./actions";
import { Card, Field, PageHeader, inputCls, btnCls } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** One school calendar for everyone: term opening/closing days, holidays the
 *  school has marked, and events — the same events the Announcements page
 *  posts. Weekends sit greyed out: school runs Monday to Friday. */
export default async function SchoolCalendar({ params, searchParams }: {
  params: Promise<{ school: string }>;
  searchParams: Promise<{ m?: string }>;
}) {
  const { school: slug } = await params;
  const { m } = await searchParams;
  const { school, user } = await requireModule(slug, "comms");
  const isAdmin = ["admin", "platform_admin"].includes(user.role);

  const now = new Date();
  const [yy, mm] = /^\d{4}-\d{2}$/.test(m ?? "")
    ? (m as string).split("-").map(Number)
    : [now.getFullYear(), now.getMonth() + 1];
  const first = new Date(Date.UTC(yy, mm - 1, 1));
  const last = new Date(Date.UTC(yy, mm, 0)); // last day of month
  const firstIso = first.toISOString().slice(0, 10);
  const lastIso = last.toISOString().slice(0, 10);
  const prev = `${mm === 1 ? yy - 1 : yy}-${String(mm === 1 ? 12 : mm - 1).padStart(2, "0")}`;
  const next = `${mm === 12 ? yy + 1 : yy}-${String(mm === 12 ? 1 : mm + 1).padStart(2, "0")}`;
  const todayIso = now.toISOString().slice(0, 10);

  const [evts, hols, allTerms, yrs, cls, current] = await Promise.all([
    db.select().from(events).where(and(eq(events.schoolId, school.id),
      gte(events.startsAt, new Date(firstIso + "T00:00:00Z")),
      lte(events.startsAt, new Date(lastIso + "T23:59:59Z")))),
    db.select().from(holidays).where(eq(holidays.schoolId, school.id)),
    db.select().from(terms).where(eq(terms.schoolId, school.id)),
    db.select().from(academicYears).where(eq(academicYears.schoolId, school.id)),
    db.select().from(classes).where(eq(classes.schoolId, school.id)),
    getCurrentTerm(school.id),
  ]);

  // families see school-wide + their own classes only — same rule as the feed
  let visible: Set<string> | null = null;
  if (user.role === "parent")
    visible = new Set((await getParentChildren(school.id, user.id)).map((k) => k.classId).filter(Boolean) as string[]);
  else if (user.role === "student")
    visible = new Set([(await getStudentSelf(school.id, user.id))?.classId].filter(Boolean) as string[]);
  const seeEvts = visible ? evts.filter((e) => !e.classId || visible.has(e.classId)) : evts;
  const className = new Map(cls.map((c) => [c.id, c.name]));
  const yearName = new Map(yrs.map((y) => [y.id, y.name]));

  const holidayByDate = new Map(hols.map((h) => [h.date, h]));
  const evtsByDate = new Map<string, typeof seeEvts>();
  for (const e of seeEvts) {
    const d = e.startsAt.toISOString().slice(0, 10);
    if (!evtsByDate.has(d)) evtsByDate.set(d, []);
    evtsByDate.get(d)!.push(e);
  }
  const termMarks = new Map<string, string>();
  for (const t of allTerms) {
    const y = yearName.get(t.yearId) ?? "";
    termMarks.set(t.startsAt, `${t.name} begins (${y})`);
    termMarks.set(t.endsAt, `${t.name} ends`);
  }

  // grid: full weeks (Mon-aligned) covering the month
  const cursor = new Date(first);
  cursor.setUTCDate(cursor.getUTCDate() - ((cursor.getUTCDay() + 6) % 7));
  const weeks: string[][] = [];
  while (cursor.toISOString().slice(0, 10) <= lastIso) {
    const row: string[] = [];
    for (let d = 0; d < 7; d++) {
      row.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(row);
  }

  // "coming up" — the next few things after today, any month
  const upHols = hols.filter((h) => h.date >= todayIso).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  const upEvts = (await db.select().from(events)
    .where(and(eq(events.schoolId, school.id), gte(events.startsAt, new Date())))
    .orderBy(events.startsAt).limit(8))
    .filter((e) => !visible || !e.classId || visible.has(e.classId)).slice(0, 5);

  const fmtD = (iso: string) =>
    new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

  return (
    <div className="grid max-w-6xl gap-6 lg:grid-cols-[1fr_300px]">
      <div>
        <PageHeader title="Calendar"
          sub={current ? `${current.year?.name} · ${current.name}` : "The school's year at a glance"} />
        <Card className="overflow-x-auto">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold" data-nums="">{MONTHS[mm - 1]} {yy}</h2>
            <div className="flex items-center gap-1">
              <Link aria-label="Previous month" href={`/calendar?m=${prev}`}
                className="rounded-md border border-border p-1.5 hover:bg-muted"><ChevronLeft size={15} /></Link>
              <Link href="/calendar"
                className="rounded-md border border-border px-2.5 py-1 text-[13.5px] font-medium hover:bg-muted">Today</Link>
              <Link aria-label="Next month" href={`/calendar?m=${next}`}
                className="rounded-md border border-border p-1.5 hover:bg-muted"><ChevronRight size={15} /></Link>
            </div>
          </div>
          <table className="mt-3 w-full table-fixed border-collapse">
            <thead>
              <tr>
                {DOW.map((d, i) => (
                  <th key={d} className={`border border-border px-1 py-1 text-[12.5px] font-semibold uppercase tracking-wide ${i >= 5 ? "w-[9%] bg-muted/60 text-faint" : "text-muted-foreground"}`}>
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((row, wi) => (
                <tr key={wi}>
                  {row.map((iso, di) => {
                    const inMonth = iso.slice(0, 7) === `${yy}-${String(mm).padStart(2, "0")}`;
                    const weekend = di >= 5;
                    const hol = holidayByDate.get(iso);
                    const mark = termMarks.get(iso);
                    const dayEvts = evtsByDate.get(iso) ?? [];
                    const isToday = iso === todayIso;
                    return (
                      <td key={iso} className={`h-20 select-none border border-border p-1 align-top
                        ${weekend ? "bg-muted/60" : hol ? "bg-danger-soft/70" : ""}
                        ${inMonth ? "" : "opacity-35"}`}>
                        <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[12.5px]
                          ${isToday ? "bg-primary font-bold text-primary-foreground" : weekend ? "text-faint" : "font-medium"}`}
                          data-nums="">
                          {Number(iso.slice(8, 10))}
                        </span>
                        {weekend && inMonth && wi === 0 && (
                          <span className="block text-[10.5px] uppercase tracking-wide text-faint">off</span>
                        )}
                        {mark && (
                          <span className="mt-0.5 block truncate rounded bg-primary/10 px-1 py-0.5 text-[11px] font-semibold text-primary" title={mark}>
                            <Flag size={9} className="mr-0.5 inline" />{mark}
                          </span>
                        )}
                        {hol && (
                          <span className="mt-0.5 block truncate rounded bg-danger/10 px-1 py-0.5 text-[11px] font-medium text-danger" title={hol.name}>
                            {hol.name}
                          </span>
                        )}
                        {dayEvts.slice(0, 2).map((e) => (
                          <span key={e.id} title={`${e.title}${e.classId ? ` · ${className.get(e.classId)}` : ""}`}
                            className="mt-0.5 block truncate rounded bg-brand-soft px-1 py-0.5 text-[11px] font-medium text-primary">
                            {e.title}
                          </span>
                        ))}
                        {dayEvts.length > 2 && (
                          <span className="block text-[11px] text-muted-foreground" data-nums="">+{dayEvts.length - 2} more</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[12.5px] text-muted-foreground">
            Weekends are greyed out — school records run Monday to Friday. Holidays show in red;
            term opening and closing days carry a flag.
          </p>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <h2 className="flex items-center gap-2 font-semibold"><CalendarRange size={15} className="text-primary" /> Coming up</h2>
          <ul className="mt-2.5 space-y-2 text-sm">
            {upEvts.map((e) => (
              <li key={e.id} className="flex items-start gap-2">
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <span className="min-w-0">
                  <span className="font-medium">{e.title}</span>
                  <span className="block text-[13px] text-muted-foreground" data-nums="">
                    {fmtD(e.startsAt.toISOString().slice(0, 10))}
                    {e.classId ? ` · ${className.get(e.classId)}` : ""}
                  </span>
                </span>
              </li>
            ))}
            {upHols.map((h) => (
              <li key={h.id} className="flex items-start gap-2">
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-danger" />
                <span className="min-w-0">
                  <span className="font-medium">{h.name}</span>
                  <span className="block text-[13px] text-muted-foreground" data-nums="">{fmtD(h.date)} · no school</span>
                </span>
              </li>
            ))}
            {upEvts.length + upHols.length === 0 && (
              <li className="text-muted-foreground">Nothing coming up yet.</li>
            )}
          </ul>
        </Card>

        {isAdmin && (
          <>
            <Card>
              <h2 className="flex items-center gap-2 font-semibold"><PartyPopper size={15} className="text-primary" /> Add an event</h2>
              <form action={addCalendarEvent.bind(null, slug)} className="mt-3 space-y-2.5">
                <Field label="Title"><input name="title" required className={inputCls} /></Field>
                <Field label="When"><input name="startsAt" type="datetime-local" required className={inputCls} /></Field>
                <Field label="Who it concerns">
                  <select name="classId" className={inputCls}>
                    <option value="">Whole school</option>
                    {cls.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                <SubmitButton className={btnCls + " w-full"} pendingText="Adding…">Add to calendar</SubmitButton>
                <p className="text-[12.5px] text-muted-foreground">Shows here and on the Announcements page — one list.</p>
              </form>
            </Card>
            <Card>
              <h2 className="flex items-center gap-2 font-semibold"><Flag size={15} className="text-danger" /> Mark a holiday</h2>
              <form action={addHoliday.bind(null, slug)} className="mt-3 space-y-2.5">
                <Field label="Name"><input name="name" required placeholder="Mid-term break" className={inputCls} /></Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="From"><input name="from" type="date" required className={inputCls} /></Field>
                  <Field label="To (optional)"><input name="to" type="date" className={inputCls} /></Field>
                </div>
                <SubmitButton className={btnCls + " w-full"} pendingText="Marking…">Mark holiday</SubmitButton>
                <p className="text-[12.5px] text-muted-foreground">
                  Holiday days drop out of attendance sheets and tallies automatically.
                </p>
              </form>
              {hols.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-border pt-3 text-[13.5px]">
                  {[...hols].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).map((h) => (
                    <li key={h.id} className="flex items-center justify-between gap-2">
                      <span data-nums="">{fmtD(h.date)} — {h.name}</span>
                      <form action={removeHoliday.bind(null, slug, h.id)}>
                        <SubmitButton className="text-[12.5px] text-danger underline-offset-2 hover:underline">remove</SubmitButton>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
