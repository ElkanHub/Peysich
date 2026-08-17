import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { schools, terms, levels, feeStructures, feeInvoices, feePayments, smsLog, lessons } from "@/db/schema";
import { uid } from "@/lib/utils";
async function main() {
  const [school] = await db.select().from(schools).where(eq(schools.slug, "stmarys"));
  const [term] = await db.select().from(terms).where(and(eq(terms.schoolId, school.id), eq(terms.isCurrent, true)));
  const lvs = await db.select().from(levels).where(eq(levels.schoolId, school.id));
  for (const l of lvs) await db.insert(feeStructures).values({ id: uid(), schoolId: school.id, termId: term.id, levelId: l.id, name: "Tuition", amountPesewas: 45000 }).onConflictDoNothing();
  // simulate generateInvoices logic (action is session-bound): direct import not possible; inline:
  const { students, classes } = await import("@/db/schema");
  const cls = await db.select().from(classes).where(eq(classes.schoolId, school.id));
  const roster = await db.select().from(students).where(and(eq(students.schoolId, school.id), eq(students.status, "active")));
  const levelOf = new Map(cls.map(c => [c.id, c.levelId]));
  for (const s of roster) {
    if (!levelOf.get(s.classId ?? "")) continue;
    await db.insert(feeInvoices).values({ id: uid(), schoolId: school.id, studentId: s.id, termId: term.id, totalPesewas: 45000 }).onConflictDoNothing();
  }
  // pay 60% of invoices (some partial)
  const invs = await db.select().from(feeInvoices).where(and(eq(feeInvoices.schoolId, school.id), eq(feeInvoices.termId, term.id)));
  let i = 0;
  for (const inv of invs) {
    if (i++ % 5 >= 3) continue;
    const amt = i % 4 === 0 ? 20000 : 45000;
    await db.insert(feePayments).values({ id: uid(), schoolId: school.id, invoiceId: inv.id, amountPesewas: amt, method: "momo", reference: `pay_${uid()}` });
    await db.update(feeInvoices).set({ paidPesewas: amt, status: amt >= inv.totalPesewas ? "paid" : "part_paid" }).where(eq(feeInvoices.id, inv.id));
  }
  const [t] = await db.select({ billed: sql<number>`sum(total_pesewas)`, paid: sql<number>`sum(paid_pesewas)`, n: sql<number>`count(*)` }).from(feeInvoices).where(and(eq(feeInvoices.schoolId, school.id), eq(feeInvoices.termId, term.id)));
  console.log(`invoices=${t.n} billed=${t.billed} collected=${t.paid}`);
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
