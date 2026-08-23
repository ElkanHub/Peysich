"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { assignments } from "@/db/schema";
import { requireModule } from "@/core/school-context";
import { uid } from "@/lib/utils";

/** Homework is set by TEACHERS for the classes they actually teach — admins
 *  read and monitor, they don't assign. */
export async function createHomework(slug: string, f: FormData) {
  const { school, user } = await requireModule(slug, "homework", ["teacher"]);
  const classId = String(f.get("classId"));
  if (user.role === "teacher") {
    const { getTeacherScope } = await import("@/core/school-context");
    const scope = await getTeacherScope(school.id, user.id);
    if (!scope?.allClassIds.has(classId)) redirect(`/homework?flash=error`);
  }
  await db.insert(assignments).values({
    id: uid(), schoolId: school.id,
    classId, subjectId: String(f.get("subjectId")),
    title: String(f.get("title")), instructions: String(f.get("instructions") || "") || null,
    dueDate: String(f.get("dueDate")), createdBy: user.id,
  });
  revalidatePath(`/homework`);
  redirect(`/homework?flash=saved`);
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
  redirect(`/homework?flash=saved`);
}

/** Teacher taps ✓ for a child who handed in on paper — a receipt, no mark. */
export async function recordSubmissionReceipt(
  slug: string, assignmentId: string, studentId: string,
) {
  const { school } = await requireModule(slug, "homework", ["admin", "teacher"]);
  const { submissions } = await import("@/db/schema");
  const [existing] = await db.select().from(submissions).where(and(
    eq(submissions.assignmentId, assignmentId), eq(submissions.studentId, studentId)));
  if (!existing) {
    await db.insert(submissions).values({
      schoolId: school.id, assignmentId, studentId,
      note: "Handed in (recorded by teacher)", submittedAt: new Date(),
    });
  }
  revalidatePath(`/homework/${assignmentId}`);
  redirect(`/homework/${assignmentId}?flash=done`);
}
