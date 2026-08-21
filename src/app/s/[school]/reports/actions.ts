"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { schools, scorePublications } from "@/db/schema";
import { publishTermReports, publishPreschoolReports } from "@/modules/assessment/publish";
import { REPORT_CONFIG_DEFAULTS, type ReportConfig } from "@/modules/assessment/report-config";
import { requireModule, getCurrentTerm } from "@/core/school-context";
import { uid } from "@/lib/utils";

/** Release one test's marks to students & parents — recorded per test,
 *  with who released it and when. */
export async function releaseComponent(slug: string, componentId: string) {
  const { school, user } = await requireModule(slug, "assessment", ["admin"]);
  const term = await getCurrentTerm(school.id);
  if (!term) redirect("/reports");
  await db.insert(scorePublications).values({
    id: uid(), schoolId: school.id, termId: term.id, componentId, publishedBy: user.name,
  }).onConflictDoNothing();
  revalidatePath("/reports"); revalidatePath("/assessment");
  redirect("/reports?flash=done");
}

/** Publish the terminal report cards for the current term (locks scores). */
export async function releaseTermReports(slug: string) {
  const { school } = await requireModule(slug, "assessment", ["admin"]);
  const term = await getCurrentTerm(school.id);
  if (!term) redirect("/reports");
  await publishTermReports(school.id, term.id);
  revalidatePath("/reports"); revalidatePath("/assessment");
  redirect("/reports?flash=done");
}

/** Release the preschool skills reports (their end-of-term report — the
 *  skills grid IS their assessment). Does not lock the term. */
export async function releasePreschoolReports(slug: string) {
  const { school } = await requireModule(slug, "assessment", ["admin"]);
  const term = await getCurrentTerm(school.id);
  if (!term) redirect("/reports");
  const n = await publishPreschoolReports(school.id, term.id);
  revalidatePath("/reports");
  redirect(`/reports?flash=${n > 0 ? "done" : "error"}`);
}

/** What appears on the report paper — checkbox per element. */
export async function saveReportConfig(slug: string, f: FormData) {
  const { school } = await requireModule(slug, "assessment", ["admin"]);
  const cfg = Object.fromEntries(
    (Object.keys(REPORT_CONFIG_DEFAULTS) as (keyof ReportConfig)[])
      .map((k) => [k, f.get(`cfg_${k}`) === "on"]),
  ) as ReportConfig;
  const [row] = await db.select({ settings: schools.settings }).from(schools)
    .where(eq(schools.id, school.id));
  await db.update(schools)
    .set({ settings: { ...(row?.settings ?? {}), reportConfig: cfg } })
    .where(eq(schools.id, school.id));
  const { invalidateSchool } = await import("@/core/tenant");
  invalidateSchool(slug); // paper pages read settings from the cached school row
  revalidatePath("/reports");
  redirect("/reports?flash=saved");
}
