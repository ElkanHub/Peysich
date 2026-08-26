import { and, eq, inArray, sql, lt } from "drizzle-orm";
import { db } from "@/db";
import {
  students, classes, terms, feeTypes, feeItems, feeInvoices, feeInvoiceLines,
  feePayments, feeAdjustments, scholarships, studentScholarships, ledgerEntries,
  docCounters,
} from "@/db/schema";
import { uid } from "@/lib/utils";
import { getFeesConfig } from "./config";

/* The money engine. Three hard rules live here and nowhere else:
 *   1. invoice lines FREEZE at generation — catalog edits never touch them;
 *   2. every money event appends ONE ledger row — corrections offset, never edit;
 *   3. document numbers are minted atomically, year-prefixed, gap-free. */

// ── numbered documents ─────────────────────────────────────────────────
export async function nextDocNo(schoolId: string, kind: "receipt" | "invoice") {
  const year = new Date().getFullYear();
  const key = `${kind}-${year}`;
  await db.insert(docCounters).values({ schoolId, key, value: 0 }).onConflictDoNothing();
  const [row] = await db.update(docCounters)
    .set({ value: sql`${docCounters.value} + 1` })
    .where(and(eq(docCounters.schoolId, schoolId), eq(docCounters.key, key)))
    .returning({ value: docCounters.value });
  return `${year}-${String(row.value).padStart(6, "0")}`;
}

// ── balances (the ledger is the truth) ─────────────────────────────────
export async function studentBalance(schoolId: string, studentId: string) {
  const [r] = await db.select({
    bal: sql<number>`coalesce(sum(debit_pesewas - credit_pesewas), 0)`,
  }).from(ledgerEntries).where(and(
    eq(ledgerEntries.schoolId, schoolId), eq(ledgerEntries.studentId, studentId)));
  return Number(r?.bal ?? 0);
}

export async function balancesFor(schoolId: string, studentIds: string[]) {
  if (!studentIds.length) return new Map<string, number>();
  const rows = await db.select({
    studentId: ledgerEntries.studentId,
    bal: sql<number>`coalesce(sum(debit_pesewas - credit_pesewas), 0)`,
  }).from(ledgerEntries)
    .where(and(eq(ledgerEntries.schoolId, schoolId), inArray(ledgerEntries.studentId, studentIds)))
    .groupBy(ledgerEntries.studentId);
  return new Map(rows.map((r) => [r.studentId, Number(r.bal)]));
}

// ── generation: catalog + flags + scholarships + adjustments + arrears ──
export async function generateInvoicesForTerm(school: {
  id: string; settings: unknown;
}, termId: string, byUserId: string) {
  const cfg = getFeesConfig(school.settings);
  const [term] = await db.select().from(terms).where(eq(terms.id, termId));
  if (!term) return { created: 0, skipped: 0 };

  const [roster, cls, types, items, schols, grants, adjs, existing] = await Promise.all([
    db.select().from(students).where(and(
      eq(students.schoolId, school.id), eq(students.status, "active"))),
    db.select().from(classes).where(eq(classes.schoolId, school.id)),
    db.select().from(feeTypes).where(eq(feeTypes.schoolId, school.id)),
    db.select().from(feeItems).where(and(
      eq(feeItems.schoolId, school.id), eq(feeItems.termId, termId))),
    db.select().from(scholarships).where(and(
      eq(scholarships.schoolId, school.id), eq(scholarships.active, true))),
    db.select().from(studentScholarships).where(eq(studentScholarships.schoolId, school.id)),
    db.select().from(feeAdjustments).where(and(
      eq(feeAdjustments.schoolId, school.id), eq(feeAdjustments.termId, termId),
      eq(feeAdjustments.invoiced, false))),
    db.select({ studentId: feeInvoices.studentId }).from(feeInvoices).where(and(
      eq(feeInvoices.schoolId, school.id), eq(feeInvoices.termId, termId))),
  ]);
  const alreadyBilled = new Set(existing.map((e) => e.studentId));
  const levelOf = new Map(cls.map((c) => [c.id, c.levelId]));
  const typeById = new Map(types.map((t) => [t.id, t]));
  const scholById = new Map(schols.map((s) => [s.id, s]));
  const grantsBy = new Map<string, typeof grants>();
  for (const g of grants) {
    if (!grantsBy.has(g.studentId)) grantsBy.set(g.studentId, []);
    grantsBy.get(g.studentId)!.push(g);
  }
  const adjsBy = new Map<string, typeof adjs>();
  for (const a of adjs) {
    if (!adjsBy.has(a.studentId)) adjsBy.set(a.studentId, []);
    adjsBy.get(a.studentId)!.push(a);
  }
  // one-off types (admission…) bill once, ever — who has already carried one?
  const onceTypeIds = types.filter((t) => !t.recurring).map((t) => t.id);
  const onceBilled = onceTypeIds.length
    ? await db.select({ studentId: feeInvoices.studentId, feeTypeId: feeInvoiceLines.feeTypeId })
        .from(feeInvoiceLines)
        .innerJoin(feeInvoices, eq(feeInvoiceLines.invoiceId, feeInvoices.id))
        .where(and(eq(feeInvoiceLines.schoolId, school.id),
          inArray(feeInvoiceLines.feeTypeId, onceTypeIds)))
    : [];
  const onceSet = new Set(onceBilled.map((o) => `${o.studentId}:${o.feeTypeId}`));
  const balances = await balancesFor(school.id, roster.map((s) => s.id));

  const addDays = (iso: string, n: number) => {
    const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const defaultDue = addDays(term.startsAt, cfg.dueWeeks * 7);

  let created = 0, skipped = 0;
  for (const s of roster) {
    if (alreadyBilled.has(s.id) || !s.classId) { skipped++; continue; }
    const levelId = levelOf.get(s.classId);
    const myItems = items.filter((it) =>
      it.levelId === levelId && (!it.classId || it.classId === s.classId));
    type Line = { label: string; amount: number; source: string; feeTypeId?: string | null };
    const lines: Line[] = [];

    // arrears first — the balance the family already owes follows the child
    const arrears = balances.get(s.id) ?? 0;
    if (arrears > 0) lines.push({
      label: "Balance brought forward", amount: arrears, source: "carry_forward",
    });

    let dueDate = defaultDue;
    for (const it of myItems) {
      const t = typeById.get(it.feeTypeId);
      if (!t) continue;
      if (t.optional && t.kind === "transport" && !s.transportRider) continue;
      if (!t.recurring && onceSet.has(`${s.id}:${t.id}`)) continue;
      lines.push({ label: t.name, amount: it.amountPesewas, source: "item", feeTypeId: t.id });
      if (it.dueDate && it.dueDate < dueDate) dueDate = it.dueDate;
    }
    if (lines.every((l) => l.source === "carry_forward") && arrears <= 0) { skipped++; continue; }

    // scholarships subtract — percent applies to the applicable items' subtotal
    for (const g of grantsBy.get(s.id) ?? []) {
      const sc = scholById.get(g.scholarshipId);
      if (!sc) continue;
      const base = lines.filter((l) => l.source === "item" &&
        (!sc.feeTypeId || l.feeTypeId === sc.feeTypeId))
        .reduce((a, l) => a + l.amount, 0);
      const off = sc.kind === "percent" ? Math.round((base * sc.value) / 100) : Math.min(sc.value, base);
      if (off > 0) lines.push({ label: sc.name, amount: -off, source: "scholarship" });
    }
    // manual adjustments, signed
    for (const a of adjsBy.get(s.id) ?? [])
      lines.push({ label: a.reason, amount: a.amountPesewas, source: "adjustment" });

    const total = lines.reduce((a, l) => a + l.amount, 0);
    if (total <= 0 && arrears <= 0) { skipped++; continue; }

    const invoiceId = uid();
    const invoiceNo = `INV ${await nextDocNo(school.id, "invoice")}`;
    await db.insert(feeInvoices).values({
      id: invoiceId, schoolId: school.id, studentId: s.id, termId,
      invoiceNo, totalPesewas: total, dueDate,
    });
    await db.insert(feeInvoiceLines).values(lines.map((l, i) => ({
      id: uid(), schoolId: school.id, invoiceId, label: l.label,
      amountPesewas: l.amount, source: l.source, feeTypeId: l.feeTypeId ?? null, sortOrder: i,
    })));
    // the invoice's NEW charges hit the ledger; arrears are already there
    const fresh = total - Math.max(arrears, 0);
    if (fresh !== 0) await db.insert(ledgerEntries).values({
      id: uid(), schoolId: school.id, studentId: s.id, kind: "invoice",
      debitPesewas: Math.max(fresh, 0), creditPesewas: Math.max(-fresh, 0),
      refId: invoiceId, memo: `${invoiceNo} · ${term.name} bill`, createdBy: byUserId,
    });
    // mark this term's adjustments as consumed by this invoice
    const myAdjs = adjsBy.get(s.id) ?? [];
    if (myAdjs.length) await db.update(feeAdjustments)
      .set({ invoiced: true })
      .where(inArray(feeAdjustments.id, myAdjs.map((a) => a.id)));
    created++;
  }
  return { created, skipped };
}

// ── payments ───────────────────────────────────────────────────────────
export async function recordPaymentFor(school: { id: string }, opts: {
  invoiceId: string; amountPesewas: number; method: string; reference?: string;
  note?: string; byUserId: string;
}) {
  const [inv] = await db.select().from(feeInvoices).where(and(
    eq(feeInvoices.id, opts.invoiceId), eq(feeInvoices.schoolId, school.id)));
  if (!inv || opts.amountPesewas <= 0) return null;
  const receiptNo = await nextDocNo(school.id, "receipt");
  const paymentId = uid();
  await db.insert(feePayments).values({
    id: paymentId, schoolId: school.id, invoiceId: inv.id,
    amountPesewas: opts.amountPesewas, method: opts.method,
    reference: opts.reference?.trim() || `pay_${paymentId}`,
    receiptNo, note: opts.note ?? null, recordedBy: opts.byUserId,
  });
  const paid = inv.paidPesewas + opts.amountPesewas;
  await db.update(feeInvoices).set({
    paidPesewas: paid, status: paid >= inv.totalPesewas ? "paid" : "part_paid",
  }).where(eq(feeInvoices.id, inv.id));
  await db.insert(ledgerEntries).values({
    id: uid(), schoolId: school.id, studentId: inv.studentId, kind: "payment",
    creditPesewas: opts.amountPesewas, refId: paymentId,
    memo: `Receipt ${receiptNo} · ${opts.method}`, createdBy: opts.byUserId,
  });
  return { paymentId, receiptNo };
}

/** Void = the record stays, an offsetting ledger row corrects the money. */
export async function voidPaymentFor(school: { id: string }, paymentId: string, byUserId: string) {
  const [p] = await db.select().from(feePayments).where(and(
    eq(feePayments.id, paymentId), eq(feePayments.schoolId, school.id)));
  if (!p || p.voidedAt) return false;
  const [inv] = await db.select().from(feeInvoices).where(eq(feeInvoices.id, p.invoiceId));
  await db.update(feePayments)
    .set({ voidedBy: byUserId, voidedAt: new Date() })
    .where(eq(feePayments.id, paymentId));
  if (inv) {
    const paid = Math.max(0, inv.paidPesewas - p.amountPesewas);
    await db.update(feeInvoices).set({
      paidPesewas: paid,
      status: paid >= inv.totalPesewas ? "paid" : paid > 0 ? "part_paid" : "unpaid",
    }).where(eq(feeInvoices.id, inv.id));
  }
  await db.insert(ledgerEntries).values({
    id: uid(), schoolId: school.id, studentId: inv?.studentId ?? "", kind: "void",
    debitPesewas: p.amountPesewas, refId: paymentId,
    memo: `Receipt ${p.receiptNo ?? p.reference} voided`, createdBy: byUserId,
  });
  return true;
}

// ── defaulters: past due, still owing ──────────────────────────────────
export async function overdueInvoices(schoolId: string, termId: string, today: string) {
  return db.select().from(feeInvoices).where(and(
    eq(feeInvoices.schoolId, schoolId), eq(feeInvoices.termId, termId),
    inArray(feeInvoices.status, ["unpaid", "part_paid"]),
    lt(feeInvoices.dueDate, today)));
}
