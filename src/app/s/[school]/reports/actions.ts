"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { schools, scorePublications, scoreSheets, terms, platformAuditLogs, classes } from "@/db/schema";
import { publishTermReports, publishPreschoolReports } from "@/modules/assessment/publish";
import { REPORT_CONFIG_DEFAULTS, type ReportConfig } from "@/modules/assessment/report-config";
import { requireModule, getCurrentTerm } from "@/core/school-context";
import { withFlash } from "@/lib/flash";
import { uid } from "@/lib/utils";

/** Every family of an active child, one row per child and guardian, through
 *  the one door: app, Telegram, then WhatsApp or SMS. Students with a login
 *  get the app notification. */
async function tellFamilies(school: { id: string; name: string; slug: string; branding: { smsSenderId?: string } }, body: string,
  kind: "results_ready" | "report_card_ready", termName: string, termId: string) {
  const { pushToUsers, schoolAudience } = await import("@/lib/push");
  await pushToUsers(await schoolAudience(school.id, { roles: ["student"] }), { title: school.name, body, url: "/reports", tag: "reports" });
  const { students, studentGuardians } = await import("@/db/schema");
  const fam = await db.select({ guardianId: studentGuardians.guardianId, sid: students.id, first: students.firstName, last: students.lastName })
    .from(studentGuardians).innerJoin(students, eq(students.id, studentGuardians.studentId))
    .where(and(eq(students.schoolId, school.id), eq(students.status, "active")));
  const { notifyMany } = await import("@/messaging/notify");
  const { schoolUrl } = await import("@/messaging/render");
  return notifyMany(school, fam.map((f) => ({
    to: { kind: "guardian" as const, id: f.guardianId }, kind,
    vars: { child: `${f.first} ${f.last}`, term: termName },
    url: `/students/${f.sid}/report/${termId}`, link: schoolUrl(school.slug, `/students/${f.sid}/report/${termId}`),
  })));
}


/** Send one test's results to parents — recorded per test, with who sent
 *  it and when. Refused on the server too if a class has not submitted. */
export async function releaseComponent(slug: string, componentId: string) {
  const { school, user: me } = await requireModule(slug, "assessment", ["admin"]);
  const term = await getCurrentTerm(school.id);
  if (!term) redirect("/reports");
  const { getStructure } = await import("@/core/academics");
  const S = await getStructure(school.id);
  const comp = S.components.find((c) => c.id === componentId);
  const sheets = await db.select({ classId: scoreSheets.classId, subjectId: scoreSheets.subjectId })
    .from(scoreSheets).where(and(eq(scoreSheets.termId, term.id),
      eq(scoreSheets.componentId, componentId), eq(scoreSheets.submitted, true)));
  const done = new Set(sheets.map((s) => `${s.classId}:${s.subjectId}`));
  const waiting = S.classes.filter((cl) => !S.levelById.get(cl.levelId)?.preschool
    && S.sectionOfClass(cl) === comp?.section
    && S.effectiveSubjectIds(cl.id).some((sid) => !done.has(`${cl.id}:${sid}`)));
  if (waiting.length) {
    redirect(withFlash("/reports", `Not sent — still waiting on ${waiting.map((c) => c.name).join(", ")}.`, { error: true }));
  }
  await db.insert(scorePublications).values({
    id: uid(), schoolId: school.id, termId: term.id, componentId, publishedBy: me.name,
  }).onConflictDoNothing();
  const r = await tellFamilies(school, "New results are out — open Reports to see them.", "results_ready", term.name, term.id);
  const { sentSentence } = await import("@/messaging/notify");
  revalidatePath("/reports"); revalidatePath("/assessment");
  redirect(withFlash("/reports", `${comp?.name ?? "Test"} results released. ${sentSentence(r)}`));
}

/** Send the end-of-term report cards for the current term (locks scores). */
export async function releaseTermReports(slug: string) {
  const { school } = await requireModule(slug, "assessment", ["admin"]);
  const term = await getCurrentTerm(school.id);
  if (!term) redirect("/reports");
  await publishTermReports(school.id, term.id);
  const r = await tellFamilies(school, `${term.name} report cards are ready — open Reports to see them.`, "report_card_ready", term.name, term.id);
  const { sentSentence } = await import("@/messaging/notify");
  revalidatePath("/reports"); revalidatePath("/assessment");
  redirect(withFlash("/reports", `Report cards released. ${sentSentence(r)} Scores are locked.`));
}

/** Send the preschool skills reports (their end-of-term report card — the
 *  skills grid IS their assessment). Does not lock the term. */
export async function releasePreschoolReports(slug: string) {
  const { school } = await requireModule(slug, "assessment", ["admin"]);
  const term = await getCurrentTerm(school.id);
  if (!term) redirect("/reports");
  const n = await publishPreschoolReports(school.id, term.id);
  if (n > 0) await tellFamilies(school, `${term.name} reports are ready — open Reports to see them.`, "report_card_ready", term.name, term.id);
  revalidatePath("/reports");
  redirect(n > 0
    ? withFlash("/reports", `Skills reports sent for ${n} children.`)
    : withFlash("/reports", "Nothing sent — no preschool child has been rated yet.", { error: true }));
}

/** Unlock scores after report cards went out. The lock lives on the term
 *  (terms.scoresLocked), so this reopens every class — the class chosen
 *  here is recorded, with who / when / why, in platform_audit_logs. */
export async function unlockScores(slug: string, f: FormData) {
  const { school, user: me } = await requireModule(slug, "assessment", ["admin"]);
  const term = await getCurrentTerm(school.id);
  if (!term) redirect("/reports");
  const reason = String(f.get("reason") ?? "").trim();
  const classId = String(f.get("classId") ?? "");
  if (!reason) redirect(withFlash("/reports", "Say why before unlocking.", { error: true }));
  const [cls] = classId
    ? await db.select({ name: classes.name }).from(classes)
        .where(and(eq(classes.id, classId), eq(classes.schoolId, school.id)))
    : [];
  await db.insert(platformAuditLogs).values({
    id: uid(), actorUserId: me.id, action: "scores.unlock", schoolId: school.id,
    detail: { termId: term.id, termName: term.name, classId: classId || null, className: cls?.name ?? null, reason, by: me.name },
  });
  await db.update(terms).set({ scoresLocked: false }).where(eq(terms.id, term.id));
  revalidatePath("/reports"); revalidatePath("/assessment");
  redirect(withFlash("/reports", `Scores unlocked${cls ? ` for ${cls.name}` : ""}. Send the report cards again when the change is done.`));
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
  redirect(withFlash("/reports", "Report design saved."));
}
