"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { feeInvoices, feeCheckouts, submissions, assignments } from "@/db/schema";
import { requireSchool, requireModule } from "@/core/school-context";
import { assertParentOf, getStudentSelf } from "@/core/portal";
import { initCheckout } from "@/lib/paystack";
import { uid } from "@/lib/utils";

/** Parent pays fees online (full or partial). Fulfilled by webhook/fake-pay. */
export async function startFeePayment(slug: string, invoiceId: string, amountGhs: number) {
  const { school, user } = await requireSchool(slug, ["parent"]);
  const [inv] = await db.select().from(feeInvoices)
    .where(and(eq(feeInvoices.id, invoiceId), eq(feeInvoices.schoolId, school.id)));
  if (!inv) return { error: "Invoice not found" };
  if (!(await assertParentOf(school.id, user.id, inv.studentId))) return { error: "Not your child" };
  const balance = inv.totalPesewas - inv.paidPesewas;
  const amount = Math.min(Math.round(amountGhs * 100), balance);
  if (amount <= 0) return { error: "Nothing to pay" };
  const reference = `fee_${uid()}`;
  await db.insert(feeCheckouts).values({ reference, schoolId: school.id, invoiceId, amountPesewas: amount });
  const { checkoutUrl } = await initCheckout({
    email: (user as { email?: string }).email ?? "parent@school",
    amountPesewas: amount, reference, callbackUrl: `/`,
    metadata: { kind: "fee", reference },
  });
  return { checkoutUrl };
}

/** Student submits homework (note + optional uploaded file key). */
export async function submitHomework(slug: string, assignmentId: string, f: FormData) {
  const { school, user } = await requireModule(slug, "homework", ["student"]);
  const me = await getStudentSelf(school.id, user.id);
  if (!me) return { error: "No student profile linked" };
  const [a] = await db.select().from(assignments)
    .where(and(eq(assignments.id, assignmentId), eq(assignments.schoolId, school.id)));
  if (!a || a.classId !== me.classId) return { error: "Not your assignment" };
  await db.insert(submissions)
    .values({
      assignmentId, studentId: me.id, schoolId: school.id,
      note: String(f.get("note") || "") || null,
      fileUrl: String(f.get("fileKey") || "") || null,
    })
    .onConflictDoUpdate({
      target: [submissions.assignmentId, submissions.studentId],
      set: {
        note: String(f.get("note") || "") || null,
        fileUrl: String(f.get("fileKey") || "") || null,
        submittedAt: new Date(),
      },
    });
  revalidatePath(`/homework/${assignmentId}`);
  return { ok: true };
}

/** Teacher marks a submission; assessed marks can feed CA manually via score sheet. */
export async function markSubmission(slug: string, assignmentId: string, studentId: string, f: FormData) {
  const { school } = await requireModule(slug, "homework", ["admin", "teacher"]);
  await db.update(submissions).set({
    mark: Number(f.get("mark")) || null,
    feedback: String(f.get("feedback") || "") || null,
  }).where(and(
    eq(submissions.assignmentId, assignmentId), eq(submissions.studentId, studentId),
    eq(submissions.schoolId, school.id)));
  revalidatePath(`/homework/${assignmentId}`);
}
