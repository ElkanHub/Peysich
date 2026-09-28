"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { submissions, assignments, students } from "@/db/schema";
import { requireModule } from "@/core/school-context";
import { getStudentSelf } from "@/core/portal";
import { withFlash } from "@/lib/flash";

/** Student submits homework (note + optional uploaded file key). */
export async function submitHomework(slug: string, assignmentId: string, f: FormData) {
  const { school, user } = await requireModule(slug, "homework", ["student"]);
  const me = await getStudentSelf(school.id, user.id);
  if (!me) return { error: "No student profile linked" };
  if (me.status !== "active")
    return { error: "This account is read-only — the student has left the school" };
  const [a] = await db.select().from(assignments)
    .where(and(eq(assignments.id, assignmentId), eq(assignments.schoolId, school.id)));
  if (!a || a.classId !== me.classId) return { error: "Not your assignment" };
  const note = String(f.get("note") || "").trim() || null;
  const fileUrl = String(f.get("fileKey") || "") || null;
  const [prev] = await db.select({ fileUrl: submissions.fileUrl }).from(submissions)
    .where(and(eq(submissions.assignmentId, assignmentId), eq(submissions.studentId, me.id)));
  // nothing is ever handed in empty; a resubmit without a new photo keeps the old one
  if (!note && !fileUrl && !prev?.fileUrl) return { error: "Add a photo or type an answer first" };
  const submittedAt = new Date();
  await db.insert(submissions)
    .values({ assignmentId, studentId: me.id, schoolId: school.id, note, fileUrl, submittedAt })
    .onConflictDoUpdate({
      target: [submissions.assignmentId, submissions.studentId],
      set: { note, fileUrl: fileUrl ?? prev?.fileUrl ?? null, submittedAt },
    });
  revalidatePath(`/homework/${assignmentId}`);
  return { ok: true, submittedAt: submittedAt.toISOString() };
}

/** Teacher marks a submission; assessed marks can feed CA manually via score sheet. */
export async function markSubmission(slug: string, assignmentId: string, studentId: string, f: FormData) {
  const { school } = await requireModule(slug, "homework", ["admin", "teacher"]);
  const raw = String(f.get("mark") ?? "").trim();
  const mark = raw === "" ? null : Number(raw);
  const feedback = String(f.get("feedback") || "").trim() || null;
  const back = `/homework/${assignmentId}`;
  if (mark !== null && !(Number.isInteger(mark) && mark >= 0 && mark <= 100))
    redirect(withFlash(back, "The mark must be a whole number from 0 to 100.", { error: true }));
  if (mark === null && !feedback)
    redirect(withFlash(back, "Type a mark or a comment first.", { error: true }));
  await db.update(submissions).set({ mark, feedback }).where(and(
    eq(submissions.assignmentId, assignmentId), eq(submissions.studentId, studentId),
    eq(submissions.schoolId, school.id)));
  const [s] = await db.select({ firstName: students.firstName, lastName: students.lastName })
    .from(students).where(eq(students.id, studentId));
  const who = s ? `${s.firstName} ${s.lastName}` : "the student";
  revalidatePath(back);
  redirect(withFlash(back, mark === null ? `Comment saved for ${who}.` : `Marked ${mark} for ${who}.`));
}
