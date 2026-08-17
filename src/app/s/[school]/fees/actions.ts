"use server";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { feeStructures, feeInvoices, feePayments, students, classes, smsLog, guardians, studentGuardians } from "@/db/schema";
import { requireModule, getCurrentTerm } from "@/core/school-context";
import { uid } from "@/lib/utils";

export async function addFeeItem(slug: string, f: FormData) {
  const { school } = await requireModule(slug, "fees", ["admin"]);
  const term = await getCurrentTerm(school.id);
  if (!term) return;
  await db.insert(feeStructures).values({
    id: uid(), schoolId: school.id, termId: term.id,
    levelId: String(f.get("levelId")), name: String(f.get("name")),
    amountPesewas: Math.round(Number(f.get("amountGhs")) * 100),
  });
  revalidatePath(`/fees`);
}

/** Generate invoices for every active student from the term's fee structure. */
export async function generateInvoices(slug: string) {
  const { school } = await requireModule(slug, "fees", ["admin"]);
  const term = await getCurrentTerm(school.id);
  if (!term) return;
  const [items, cls, roster] = await Promise.all([
    db.select().from(feeStructures)
      .where(and(eq(feeStructures.schoolId, school.id), eq(feeStructures.termId, term.id))),
    db.select().from(classes).where(eq(classes.schoolId, school.id)),
    db.select().from(students)
      .where(and(eq(students.schoolId, school.id), eq(students.status, "active"))),
  ]);
  const levelOf = new Map(cls.map((c) => [c.id, c.levelId]));
  const totalByLevel = new Map<string, number>();
  for (const it of items)
    totalByLevel.set(it.levelId, (totalByLevel.get(it.levelId) ?? 0) + it.amountPesewas);
  for (const s of roster) {
    const total = totalByLevel.get(levelOf.get(s.classId ?? "") ?? "") ?? 0;
    if (!total) continue;
    await db.insert(feeInvoices)
      .values({ id: uid(), schoolId: school.id, studentId: s.id, termId: term.id, totalPesewas: total })
      .onConflictDoNothing(); // never double-bill a student for a term
  }
  revalidatePath(`/fees`);
}

/** Record a payment (bursar cash entry or MoMo fulfillment). Partial is normal. */
export async function recordPayment(slug: string, invoiceId: string, f: FormData) {
  const { school, user } = await requireModule(slug, "fees", ["admin"]);
  const [inv] = await db.select().from(feeInvoices)
    .where(and(eq(feeInvoices.id, invoiceId), eq(feeInvoices.schoolId, school.id)));
  if (!inv) return;
  const amount = Math.round(Number(f.get("amountGhs")) * 100);
  if (amount <= 0) return;
  await db.insert(feePayments).values({
    id: uid(), schoolId: school.id, invoiceId, amountPesewas: amount,
    method: String(f.get("method") || "cash"), reference: `pay_${uid()}`, recordedBy: user.id,
  });
  const paid = inv.paidPesewas + amount;
  await db.update(feeInvoices).set({
    paidPesewas: paid, status: paid >= inv.totalPesewas ? "paid" : "part_paid",
  }).where(eq(feeInvoices.id, invoiceId));
  revalidatePath(`/fees`);
}

/** Reminder SMS to guardians of unpaid/part-paid invoices (defaulters sweep). */
export async function sendFeeReminders(slug: string) {
  const { school } = await requireModule(slug, "fees", ["admin"]);
  const term = await getCurrentTerm(school.id);
  if (!term) return;
  const unpaid = await db.select().from(feeInvoices).where(and(
    eq(feeInvoices.schoolId, school.id), eq(feeInvoices.termId, term.id),
    inArray(feeInvoices.status, ["unpaid", "part_paid"])));
  if (!unpaid.length) return;
  const gs = await db.select({ phone: guardians.phone, sid: studentGuardians.studentId })
    .from(studentGuardians)
    .innerJoin(guardians, eq(studentGuardians.guardianId, guardians.id))
    .where(inArray(studentGuardians.studentId, unpaid.map((i) => i.studentId)));
  const balance = new Map(unpaid.map((i) => [i.studentId, i.totalPesewas - i.paidPesewas]));
  await db.insert(smsLog).values(gs.map((g) => ({
    id: uid(), schoolId: school.id, to: g.phone, kind: "fees",
    body: `${school.name}: outstanding fees of GHS ${((balance.get(g.sid) ?? 0) / 100).toFixed(2)} for this term. Please settle at the office or via MoMo.`,
    status: process.env.SMS_API_KEY ? "sent" : "queued",
  })));
  revalidatePath(`/fees`);
}
