import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { holidays } from "@/db/schema";

/* The school-day rules the whole app follows: Monday–Friday only, minus the
 * holidays the school has marked. Attendance, the register book, the
 * calendar and week numbers all read from HERE — one source of truth. */

export const isWeekend = (iso: string) => {
  const d = new Date(iso + "T12:00:00Z").getUTCDay();
  return d === 0 || d === 6;
};

export const todayIso = () => new Date().toISOString().slice(0, 10);

const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** The Monday of the week containing the given date. */
export const mondayOf = (iso: string) => {
  const d = new Date(iso + "T12:00:00Z");
  const shift = (d.getUTCDay() + 6) % 7; // mon=0 … sun=6
  return addDays(iso, -shift);
};

/** All holidays a school has marked, as date → name. Small table, cached
 *  per request. */
export const getHolidayMap = cache(async (schoolId: string) => {
  const rows = await db.select().from(holidays).where(eq(holidays.schoolId, schoolId));
  return new Map(rows.map((h) => [h.date, h.name]));
});

/** Every school day (Mon–Fri, non-holiday) from start to end inclusive. */
export function schoolDaysBetween(startIso: string, endIso: string, holidayMap?: Map<string, string>) {
  const days: string[] = [];
  for (let d = startIso; d <= endIso && days.length < 500; d = addDays(d, 1))
    if (!isWeekend(d) && !holidayMap?.has(d)) days.push(d);
  return days;
}

/** The most recent school day on or before the given date (for defaulting
 *  register work when someone opens the app on a weekend). */
export function lastSchoolDay(iso: string, holidayMap?: Map<string, string>) {
  let d = iso;
  for (let i = 0; i < 30; i++) {
    if (!isWeekend(d) && !holidayMap?.has(d)) return d;
    d = addDays(d, -1);
  }
  return iso;
}

/** Term weeks, Monday-aligned: week 1 is the week containing the term's
 *  first day. Gives "Week 3 of 13" for dashboards and the register book. */
export function termWeeks(term: { startsAt: string; endsAt: string }) {
  const first = mondayOf(term.startsAt);
  const weeks: { n: number; monday: string; days: string[] }[] = [];
  for (let m = first, n = 1; m <= term.endsAt && n <= 60; m = addDays(m, 7), n++)
    weeks.push({ n, monday: m, days: [0, 1, 2, 3, 4].map((i) => addDays(m, i)) });
  return weeks;
}

/** Where today falls in the term: null before it starts / after it ends. */
export function weekOfTerm(term: { startsAt: string; endsAt: string }, iso = todayIso()) {
  const total = termWeeks(term).length;
  if (iso < term.startsAt || iso > term.endsAt) return { current: null, total };
  const diff = (Date.parse(mondayOf(iso)) - Date.parse(mondayOf(term.startsAt))) / 86400000;
  return { current: Math.floor(diff / 7) + 1, total };
}

// ── school hours (settings.schoolHours — the single place they live) ──
export type SchoolHours = { open: string; close: string }; // "HH:MM"
export const SCHOOL_HOURS_DEFAULTS: SchoolHours = { open: "07:30", close: "15:00" };

export function getSchoolHours(settings: unknown): SchoolHours {
  const raw = (settings as { schoolHours?: Partial<SchoolHours> } | null)?.schoolHours ?? {};
  const ok = (v: unknown) => typeof v === "string" && /^\d{2}:\d{2}$/.test(v);
  return {
    open: ok(raw.open) ? (raw.open as string) : SCHOOL_HOURS_DEFAULTS.open,
    close: ok(raw.close) ? (raw.close as string) : SCHOOL_HOURS_DEFAULTS.close,
  };
}
