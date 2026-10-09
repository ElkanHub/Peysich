"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { assignments, classes } from "@/db/schema";
import { requireModule, getTeacherScope } from "@/core/school-context";
import { withFlash } from "@/lib/flash";
import { uid } from "@/lib/utils";

/** "due Tuesday" inside the week, "due 7 Oct" beyond it. */
function dueWord(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  const days = Math.round((d.getTime() - new Date(new Date().toDateString()).getTime()) / 86400000);
  return days >= 0 && days < 7
    ? d.toLocaleDateString("en-GB", { weekday: "long" })
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Homework is set by TEACHERS for the classes they actually teach — admins
 *  read and monitor, they don't assign. */
export async function createHomework(slug: string, f: FormData) {
  const { school, user } = await requireModule(slug, "homework", ["teacher"]);
  const classId = String(f.get("classId") || "");
  const subjectId = String(f.get("subjectId") || "");
  const title = String(f.get("title") || "").trim();
  const dueDate = String(f.get("dueDate") || "");
  const back = `/homework`;
  if (!title) redirect(withFlash(back, "Say what the homework is.", { error: true }));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) redirect(withFlash(back, "Pick a due date.", { error: true }));
  if (!subjectId) redirect(withFlash(back, "Pick a subject.", { error: true }));
  const scope = await getTeacherScope(school.id, user.id);
  if (!scope?.allClassIds.has(classId))
    redirect(withFlash(back, "That isn't one of your classes.", { error: true }));
  // the pair must match: a subject you teach in THIS class, or any subject of your homeroom
  const { getStructure } = await import("@/core/academics");
  const S = await getStructure(school.id);
  const allowed = scope.cells.some((c) => c.classId === classId && c.subjectId === subjectId)
    || (scope.homeroomIds.has(classId) && S.effectiveSubjectIds(classId).includes(subjectId));
  if (!allowed) redirect(withFlash(back, "You don't teach that subject in that class.", { error: true }));

  await db.insert(assignments).values({
    id: uid(), schoolId: school.id, classId, subjectId, title,
    instructions: String(f.get("instructions") || "") || null,
    dueDate, createdBy: user.id,
  });

  // tell the class's families through the one door: app, Telegram, WhatsApp or SMS
  const [cls] = await db.select({ name: classes.name }).from(classes).where(eq(classes.id, classId));
  const className = cls?.name ?? "the class";
  const { students, studentGuardians } = await import("@/db/schema");
  const fam = await db.select({ guardianId: studentGuardians.guardianId })
    .from(studentGuardians).innerJoin(students, eq(students.id, studentGuardians.studentId))
    .where(and(eq(students.classId, classId), eq(students.status, "active")));
  const { notifyMany, sentSentence } = await import("@/messaging/notify");
  const r = await notifyMany(school, [...new Set(fam.map((f) => f.guardianId))].map((id) => ({
    to: { kind: "guardian" as const, id }, kind: "homework_set" as const,
    vars: { class: className, title, due: dueWord(dueDate) }, url: "/homework",
  })));
  revalidatePath(`/homework`);
  redirect(withFlash(back, `Given to ${className} · due ${dueWord(dueDate)}. ${sentSentence(r)}`));
}

/** School choice: track hand-ins? also record marks in-app? */
export async function saveHomeworkConfig(slug: string, f: FormData) {
  const { school } = await requireModule(slug, "homework", ["admin"]);
  const { schools } = await import("@/db/schema");
  const [row] = await db.select({ settings: schools.settings }).from(schools)
    .where(eq(schools.id, school.id));
  await db.update(schools).set({
    settings: {
      ...(row?.settings ?? {}),
      homeworkConfig: {
        recordSubmissions: f.get("recordSubmissions") === "on",
        recordMarks: f.get("recordMarks") === "on",
      },
    },
  }).where(eq(schools.id, school.id));
  const { invalidateSchool } = await import("@/core/tenant");
  invalidateSchool(slug);
  revalidatePath(`/homework`);
  redirect(withFlash(`/homework`, "Homework settings saved."));
}

/** Teacher records that a child handed in on paper — a receipt, no mark. */
export async function recordSubmissionReceipt(
  slug: string, assignmentId: string, studentId: string,
) {
  const { school } = await requireModule(slug, "homework", ["admin", "teacher"]);
  const { submissions, students } = await import("@/db/schema");
  const [existing] = await db.select().from(submissions).where(and(
    eq(submissions.assignmentId, assignmentId), eq(submissions.studentId, studentId)));
  if (!existing) {
    await db.insert(submissions).values({
      schoolId: school.id, assignmentId, studentId,
      note: "Handed in (recorded by teacher)", submittedAt: new Date(),
    });
  }
  const [s] = await db.select({ firstName: students.firstName, lastName: students.lastName })
    .from(students).where(eq(students.id, studentId));
  revalidatePath(`/homework/${assignmentId}`);
  redirect(withFlash(`/homework/${assignmentId}`,
    `${s ? `${s.firstName} ${s.lastName}` : "Student"} marked as handed in.`));
}
