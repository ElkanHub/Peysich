"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { events, holidays } from "@/db/schema";
import { requireModule } from "@/core/school-context";
import { isWeekend } from "@/core/calendar";
import { uid } from "@/lib/utils";

const touch = (back: string) => {
  revalidatePath(`/calendar`);
  revalidatePath(`/comms`);
  revalidatePath(`/attendance/register`);
  redirect(`${back}?flash=saved`);
};

/** Add an event from the calendar — same events table the Announcements
 *  page writes to, so both stay one list. */
export async function addCalendarEvent(slug: string, f: FormData) {
  const { school } = await requireModule(slug, "comms", ["admin"]);
  const startsAt = new Date(String(f.get("startsAt")));
  if (isNaN(+startsAt)) redirect(`/calendar?flash=error`);
  await db.insert(events).values({
    id: uid(), schoolId: school.id, title: String(f.get("title")),
    description: String(f.get("description") || "") || null,
    classId: String(f.get("classId") || "") || null,
    startsAt,
  });
  touch("/calendar");
}

/** Mark a holiday (or a run of days). One row per weekday — weekends are
 *  never school days so they need no row. Attendance sheets, the calendar
 *  and week tallies all pick these up. */
export async function addHoliday(slug: string, f: FormData) {
  const { school } = await requireModule(slug, "comms", ["admin"]);
  const back = String(f.get("back") || "/calendar");
  const name = String(f.get("name") ?? "").trim();
  const from = String(f.get("from") ?? "");
  const to = String(f.get("to") || from);
  if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from)
    redirect(`${back}?flash=error`);
  const rows: { id: string; schoolId: string; date: string; name: string }[] = [];
  const d = new Date(from + "T12:00:00Z");
  for (let i = 0; i < 60; i++) {
    const iso = d.toISOString().slice(0, 10);
    if (iso > to) break;
    if (!isWeekend(iso)) rows.push({ id: uid(), schoolId: school.id, date: iso, name });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  if (rows.length) await db.insert(holidays).values(rows).onConflictDoNothing();
  touch(back);
}

export async function removeHoliday(slug: string, holidayId: string, f: FormData) {
  const { school } = await requireModule(slug, "comms", ["admin"]);
  const back = String(f.get("back") || "/calendar");
  await db.delete(holidays).where(and(eq(holidays.id, holidayId), eq(holidays.schoolId, school.id)));
  touch(back);
}
