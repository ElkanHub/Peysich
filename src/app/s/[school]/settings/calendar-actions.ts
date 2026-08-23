"use server";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { terms } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { invalidateSchool } from "@/core/tenant";

/** Set one term's start/end dates — the dates ARE the academic calendar:
 *  the active term, week numbers, the register book and the calendar all
 *  derive from them. Guarded so a term can't end before it starts or sit
 *  on top of a sibling term. */
export async function updateTermDates(slug: string, termId: string, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  const startsAt = String(f.get("startsAt") ?? "");
  const endsAt = String(f.get("endsAt") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startsAt) || !/^\d{4}-\d{2}-\d{2}$/.test(endsAt) || endsAt <= startsAt)
    redirect(`/settings?err=termdates`);
  const [t] = await db.select().from(terms)
    .where(and(eq(terms.id, termId), eq(terms.schoolId, school.id)));
  if (!t) redirect(`/settings?flash=error`);
  const siblings = await db.select().from(terms)
    .where(and(eq(terms.schoolId, school.id), eq(terms.yearId, t.yearId), ne(terms.id, termId)));
  if (siblings.some((s) => startsAt <= s.endsAt && endsAt >= s.startsAt))
    redirect(`/settings?err=termoverlap`);
  await db.update(terms).set({ startsAt, endsAt })
    .where(and(eq(terms.id, termId), eq(terms.schoolId, school.id)));
  revalidatePath(`/settings`);
  revalidatePath(`/calendar`);
  redirect(`/settings?flash=saved`);
}

/** School hours live in settings.schoolHours — dashboards' closing-time
 *  countdown reads them from here. */
export async function saveSchoolHours(slug: string, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  const open = String(f.get("open") ?? "");
  const close = String(f.get("close") ?? "");
  if (!/^\d{2}:\d{2}$/.test(open) || !/^\d{2}:\d{2}$/.test(close) || close <= open)
    redirect(`/settings?err=hours`);
  const { schools } = await import("@/db/schema");
  const settings = { ...(school.settings as Record<string, unknown>), schoolHours: { open, close } };
  await db.update(schools).set({ settings }).where(eq(schools.id, school.id));
  invalidateSchool(slug);
  revalidatePath(`/settings`);
  redirect(`/settings?flash=saved`);
}
