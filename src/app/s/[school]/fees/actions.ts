"use server";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  feeTypes, feeItems, feeInvoices, students, guardians, studentGuardians,
  scholarships, studentScholarships, feeAdjustments, smsLog, schools,
} from "@/db/schema";
import { requireModule, getCurrentTerm } from "@/core/school-context";
import { canFeeAction, type FeeActionKey } from "@/core/access";
import { invalidateSchool } from "@/core/tenant";
import { uid } from "@/lib/utils";
import { withFlash } from "@/lib/flash";
import {
  generateInvoicesForTerm, recordPaymentFor, voidPaymentFor, overdueInvoices, sendReceiptSms,
} from "@/modules/fees/engine";
import { getFeesConfig, getRemindersSent, reminderBody, ghs } from "@/modules/fees/config";

/** Gate: signed-in fees admin AND granted this money action (Team & access). */
async function requireFees(slug: string, action?: FeeActionKey) {
  const ctx = await requireModule(slug, "fees", ["admin"]);
  if (action && !(await canFeeAction(ctx.school.id, ctx.user.id, ctx.user.role, action)))
    redirect(withFlash("/fees", "Your access doesn't cover that money action — ask a full admin under Settings → Team & access.", { error: true }));
  return ctx;
}

const touch = (extra?: string) => {
  revalidatePath(`/fees`);
  revalidatePath(`/fees/setup`);
  if (extra) revalidatePath(extra);
};

// ── settings ───────────────────────────────────────────────────────────
export async function saveFeesSettings(slug: string, f: FormData) {
  const { school } = await requireFees(slug, "catalog");
  const settings = {
    ...(school.settings as Record<string, unknown>),
    feesConfig: {
      channelsText: String(f.get("channelsText") ?? "").slice(0, 600),
      confirmPhone: String(f.get("confirmPhone") ?? "").slice(0, 30),
      dueWeeks: Math.max(1, Math.min(12, Number(f.get("dueWeeks")) || 4)),
      clearanceGate: ["warn", "block", "off"].includes(String(f.get("clearanceGate")))
        ? String(f.get("clearanceGate")) : "warn",
    },
  };
  await db.update(schools).set({ settings }).where(eq(schools.id, school.id));
  invalidateSchool(slug);
  touch("/settings");
  redirect(`/fees/setup?flash=saved`);
}

// ── catalog: types ─────────────────────────────────────────────────────
export async function addFeeType(slug: string, f: FormData) {
  const { school } = await requireFees(slug, "catalog");
  await db.insert(feeTypes).values({
    id: uid(), schoolId: school.id, name: String(f.get("name")).trim(),
    kind: String(f.get("kind") || "other"),
    recurring: f.get("recurring") !== "once",
    optional: f.get("optional") === "on",
  });
  touch(); redirect(`/fees/setup?flash=saved`);
}

export async function updateFeeType(slug: string, typeId: string, f: FormData) {
  const { school } = await requireFees(slug, "catalog");
  await db.update(feeTypes).set({
    name: String(f.get("name")).trim(),
    kind: String(f.get("kind") || "other"),
    recurring: f.get("recurring") !== "once",
    optional: f.get("optional") === "on",
  }).where(and(eq(feeTypes.id, typeId), eq(feeTypes.schoolId, school.id)));
  touch(); redirect(`/fees/setup?flash=saved`);
}

export async function deleteFeeType(slug: string, typeId: string) {
  const { school } = await requireFees(slug, "catalog");
  await db.delete(feeTypes).where(and(eq(feeTypes.id, typeId), eq(feeTypes.schoolId, school.id)));
  touch(); redirect(`/fees/setup?flash=done`);
}

// ── catalog: amounts per level ─────────────────────────────────────────
export async function saveFeeItem(slug: string, f: FormData) {
  const { school } = await requireFees(slug, "catalog");
  const term = await getCurrentTerm(school.id);
  if (!term) redirect(`/fees/setup?flash=error`);
  const feeTypeId = String(f.get("feeTypeId"));
  const levelId = String(f.get("levelId"));
  const amount = Math.round(Number(f.get("amountGhs")) * 100);
  const dueDate = String(f.get("dueDate") || "") || null;
  const [existing] = await db.select().from(feeItems).where(and(
    eq(feeItems.schoolId, school.id), eq(feeItems.termId, term.id),
    eq(feeItems.feeTypeId, feeTypeId), eq(feeItems.levelId, levelId)));
  if (amount <= 0) {
    if (existing) await db.delete(feeItems).where(eq(feeItems.id, existing.id));
  } else if (existing) {
    await db.update(feeItems).set({ amountPesewas: amount, dueDate }).where(eq(feeItems.id, existing.id));
  } else {
    await db.insert(feeItems).values({
      id: uid(), schoolId: school.id, feeTypeId, termId: term.id, levelId,
      amountPesewas: amount, dueDate,
    });
  }
  touch(); redirect(`/fees/setup?flash=saved`);
}

/** Start the new term from the previous one — amounts copy, then adjust. */
export async function copyItemsFromTerm(slug: string, fromTermId: string) {
  const { school } = await requireFees(slug, "catalog");
  const term = await getCurrentTerm(school.id);
  if (!term || fromTermId === term.id) redirect(`/fees/setup?flash=error`);
  const src = await db.select().from(feeItems).where(and(
    eq(feeItems.schoolId, school.id), eq(feeItems.termId, fromTermId)));
  for (const it of src) {
    await db.insert(feeItems).values({
      id: uid(), schoolId: school.id, feeTypeId: it.feeTypeId, termId: term.id,
      levelId: it.levelId, classId: it.classId, amountPesewas: it.amountPesewas,
    }).onConflictDoNothing();
  }
  touch(); redirect(`/fees/setup?flash=done`);
}

// ── scholarships ───────────────────────────────────────────────────────
export async function addScholarship(slug: string, f: FormData) {
  const { school } = await requireFees(slug, "catalog");
  await db.insert(scholarships).values({
    id: uid(), schoolId: school.id, name: String(f.get("name")).trim(),
    kind: f.get("kind") === "fixed" ? "fixed" : "percent",
    value: f.get("kind") === "fixed"
      ? Math.round(Number(f.get("value")) * 100)
      : Math.max(1, Math.min(100, Number(f.get("value")) || 0)),
    feeTypeId: String(f.get("feeTypeId") || "") || null,
  });
  touch(); redirect(`/fees/setup?flash=saved`);
}

export async function deleteScholarship(slug: string, id: string) {
  const { school } = await requireFees(slug, "catalog");
  await db.delete(scholarships).where(and(eq(scholarships.id, id), eq(scholarships.schoolId, school.id)));
  touch(); redirect(`/fees/setup?flash=done`);
}

export async function grantScholarship(slug: string, studentId: string, f: FormData) {
  const { school, user } = await requireFees(slug, "catalog");
  const scholarshipId = String(f.get("scholarshipId"));
  if (!scholarshipId) redirect(`/students/${studentId}?tab=fees&flash=error`);
  await db.insert(studentScholarships).values({
    schoolId: school.id, studentId, scholarshipId,
    note: String(f.get("note") || "") || null, grantedBy: user.name,
  }).onConflictDoNothing();
  touch(`/students/${studentId}`);
  redirect(`/students/${studentId}?tab=fees&flash=saved`);
}

export async function revokeScholarship(slug: string, studentId: string, scholarshipId: string) {
  const { school } = await requireFees(slug, "catalog");
  await db.delete(studentScholarships).where(and(
    eq(studentScholarships.schoolId, school.id),
    eq(studentScholarships.studentId, studentId),
    eq(studentScholarships.scholarshipId, scholarshipId)));
  touch(`/students/${studentId}`);
  redirect(`/students/${studentId}?tab=fees&flash=done`);
}

// ── per-child flags & adjustments ──────────────────────────────────────
export async function setTransportRider(slug: string, studentId: string, f: FormData) {
  const { school } = await requireFees(slug, "catalog");
  await db.update(students).set({ transportRider: f.get("rider") === "on" })
    .where(and(eq(students.id, studentId), eq(students.schoolId, school.id)));
  touch(`/students/${studentId}`);
  redirect(`/students/${studentId}?tab=fees&flash=saved`);
}

export async function addAdjustment(slug: string, studentId: string, f: FormData) {
  const { school, user } = await requireFees(slug, "catalog");
  const term = await getCurrentTerm(school.id);
  if (!term) redirect(`/students/${studentId}?tab=fees&flash=error`);
  const amount = Math.round(Number(f.get("amountGhs")) * 100);
  const reason = String(f.get("reason") ?? "").trim();
  if (!amount || !reason) redirect(`/students/${studentId}?tab=fees&flash=error`);
  await db.insert(feeAdjustments).values({
    id: uid(), schoolId: school.id, studentId, termId: term.id,
    amountPesewas: amount, reason, createdBy: user.name,
  });
  // if this term's invoice already exists, apply it now as a visible new line
  const [inv] = await db.select().from(feeInvoices).where(and(
    eq(feeInvoices.studentId, studentId), eq(feeInvoices.termId, term.id)));
  if (inv) {
    const { feeInvoiceLines, ledgerEntries } = await import("@/db/schema");
    await db.insert(feeInvoiceLines).values({
      id: uid(), schoolId: school.id, invoiceId: inv.id, label: reason,
      amountPesewas: amount, source: "adjustment", sortOrder: 99,
    });
    const total = inv.totalPesewas + amount;
    await db.update(feeInvoices).set({
      totalPesewas: total,
      status: inv.paidPesewas >= total ? "paid" : inv.paidPesewas > 0 ? "part_paid" : "unpaid",
    }).where(eq(feeInvoices.id, inv.id));
    await db.insert(ledgerEntries).values({
      id: uid(), schoolId: school.id, studentId, kind: "adjustment",
      debitPesewas: Math.max(amount, 0), creditPesewas: Math.max(-amount, 0),
      refId: inv.id, memo: reason, createdBy: user.id,
    });
    await db.update(feeAdjustments).set({ invoiced: true })
      .where(and(eq(feeAdjustments.studentId, studentId), eq(feeAdjustments.termId, term.id),
        eq(feeAdjustments.reason, reason)));
  }
  touch(`/students/${studentId}`);
  redirect(`/students/${studentId}?tab=fees&flash=saved`);
}

// ── generation ─────────────────────────────────────────────────────────
/** Create this term's bills, then tell each parent by SMS. */
export async function generateInvoices(slug: string) {
  const { school, user } = await requireFees(slug, "generate");
  const term = await getCurrentTerm(school.id);
  if (!term) redirect(withFlash("/fees", "No current term — set one under Settings first.", { error: true }));
  const r = await generateInvoicesForTerm(school, term.id, user.id);
  touch();
  if (!r.created) redirect(withFlash("/fees", "Every child already has a bill for this term. Nothing new to create."));
  const gs = await db.select({ phone: guardians.phone, sid: studentGuardians.studentId, isPrimary: studentGuardians.isPrimary })
    .from(studentGuardians)
    .innerJoin(guardians, eq(studentGuardians.guardianId, guardians.id))
    .where(inArray(studentGuardians.studentId, r.bills.map((b) => b.studentId)));
  const cfg = getFeesConfig(school.settings);
  const { sendSmsBatch } = await import("@/lib/notify");
  const seen = new Set<string>();
  await sendSmsBatch(r.bills.flatMap((b) => {
    const g = gs.find((x) => x.sid === b.studentId && x.isPrimary) ?? gs.find((x) => x.sid === b.studentId);
    if (!g || seen.has(g.phone)) return [];
    seen.add(g.phone);
    return [{
      schoolId: school.id, to: g.phone, kind: "fees", senderId: school.branding.smsSenderId,
      body: `${school.name}: ${term.name} fees are ${ghs(b.total)}, due ${b.dueDate}. Pay at the office${cfg.confirmPhone ? ` — confirm payment numbers on ${cfg.confirmPhone}` : ""}.`,
    }];
  }));
  redirect(withFlash("/fees", `${r.created} bill${r.created === 1 ? "" : "s"} created. Parents told.`));
}

// ── collection ─────────────────────────────────────────────────────────
export async function recordPayment(slug: string, invoiceId: string, f: FormData) {
  const { school, user } = await requireFees(slug, "record");
  const amount = Math.round(Number(f.get("amountGhs")) * 100);
  const method = String(f.get("method") || "cash");
  const reference = String(f.get("reference") || "").trim();
  const back = `/fees/invoice/${invoiceId}`;
  if (!(amount > 0)) redirect(withFlash(back, "Type an amount above zero — nothing was saved.", { error: true }));
  if (method !== "cash" && !reference)
    redirect(withFlash(back, `A ${method === "momo" ? "MoMo" : "bank"} payment needs its reference — nothing was saved.`, { error: true }));
  const r = await recordPaymentFor(school, {
    invoiceId, amountPesewas: amount, method,
    reference: reference || undefined,
    note: String(f.get("note") || "") || undefined,
    byUserId: user.id,
  });
  touch(back);
  if (!r) redirect(withFlash(back, "That bill could not be found — nothing was saved.", { error: true }));
  const texted = await sendReceiptSms(school, { ...r, amountPesewas: amount });
  redirect(withFlash(`/fees/receipt/${r.paymentId}`,
    `Payment of ${ghs(amount)} saved. ${texted ? `Receipt SMS sent to ${texted}.` : "No phone on file, so no receipt SMS."}`));
}

export async function voidPayment(slug: string, paymentId: string) {
  const { school, user } = await requireFees(slug, "voidPay");
  const ok = await voidPaymentFor(school, paymentId, user.id);
  touch(`/fees/receipt/${paymentId}`);
  redirect(withFlash(`/fees/receipt/${paymentId}`,
    ok ? "Receipt voided. The money is back on the child's balance." : "That receipt is already void.", { error: !ok }));
}

// ── papers out ─────────────────────────────────────────────────────────
/** Email this exact invoice, as a PDF, to every guardian with an email. */
export async function emailInvoice(slug: string, invoiceId: string) {
  const { school } = await requireFees(slug);
  const { loadInvoiceDoc, guardianEmailsFor } = await import("@/modules/fees/docs");
  const d = await loadInvoiceDoc(school, invoiceId);
  if (!d) redirect(withFlash("/fees", "That bill could not be found.", { error: true }));
  const to = await guardianEmailsFor(school.id, d.student.id);
  if (!to.length) redirect(withFlash(`/fees/invoice/${invoiceId}`,
    "No guardian of this child has an email on file — add one under Guardians first.", { error: true }));
  const { invoicePdfBuffer } = await import("@/modules/fees/pdf");
  const { sendEmail } = await import("@/lib/notify");
  const pdf = await invoicePdfBuffer(d);
  const cfg = getFeesConfig(school.settings);
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
      <h2 style="margin:0 0 4px">${school.name}</h2>
      <p style="margin:0 0 14px;color:#6b7280;font-size:13px">Fee invoice for ${d.student.firstName} ${d.student.lastName} — ${d.termName}, ${d.yearName}</p>
      <p style="font-size:15px">The attached PDF is the full invoice, exactly as it prints at the school.
        Balance due: <b>GHS ${(Math.max(0, d.invoice.totalPesewas - d.invoice.paidPesewas) / 100).toFixed(2)}</b>${d.invoice.dueDate ? ` by <b>${d.invoice.dueDate}</b>` : ""}.</p>
      <div style="border:1.5px solid #b45309;border-radius:8px;padding:12px;font-size:13px;margin:14px 0">
        <b style="color:#b45309">⚠ Before you send money electronically:</b> confirm any payment number with the school
        ${cfg.confirmPhone ? `by calling <b>${cfg.confirmPhone}</b>` : "directly"} first. ${school.name} never changes its
        payment numbers by SMS or email — and SchoolSpec never collects school fees on a school's behalf.
      </div>
      <p style="color:#9aa1ab;font-size:12px">Sent by ${school.name} via SchoolSpec.</p>
    </div>`;
  let sentAny = false;
  for (const g of to) {
    const { sent } = await sendEmail(g.email, `${school.name} — fee invoice (${d.termName})`, html,
      school.name, [{ filename: `${(d.invoice.invoiceNo ?? "invoice").replace(/\s/g, "-")}.pdf`, content: pdf }]);
    sentAny = sentAny || sent;
    await db.insert(smsLog).values({
      id: uid(), schoolId: school.id, to: g.email, body: `Invoice ${d.invoice.invoiceNo ?? ""} · ${d.termName}`,
      kind: "invoice-email", status: sent ? "sent" : "queued",
    });
  }
  touch(`/fees/invoice/${invoiceId}`);
  redirect(withFlash(`/fees/invoice/${invoiceId}`,
    sentAny ? `Invoice emailed to ${to.map((g) => g.name).join(", ")}.` : "Email is not switched on yet — the invoice was queued, not sent.", { error: !sentAny }));
}

/** Reminder SMS to guardians of OVERDUE invoices, confirm-number included.
 *  One send per day: the time and count live in schools.settings.feeRemindersSent. */
export async function sendFeeReminders(slug: string) {
  const { school } = await requireFees(slug);
  const term = await getCurrentTerm(school.id);
  const back = "/fees?tab=reminders";
  if (!term) redirect(withFlash(back, "No current term — set one under Settings first.", { error: true }));
  const last = getRemindersSent(school.settings);
  if (last && last.at.toDateString() === new Date().toDateString())
    redirect(withFlash(back, "Reminders already went out today. Try again tomorrow.", { error: true }));
  const today = new Date().toISOString().slice(0, 10);
  const due = await overdueInvoices(school.id, term.id, today);
  if (!due.length) redirect(withFlash(back, "Nobody is past the due date — no reminders to send."));
  const gs = await db.select({ phone: guardians.phone, sid: studentGuardians.studentId })
    .from(studentGuardians)
    .innerJoin(guardians, eq(studentGuardians.guardianId, guardians.id))
    .where(inArray(studentGuardians.studentId, due.map((i) => i.studentId)));
  const balance = new Map(due.map((i) => [i.studentId, i.totalPesewas - i.paidPesewas]));
  const cfg = getFeesConfig(school.settings);
  const { sendSmsBatch } = await import("@/lib/notify");
  await sendSmsBatch(gs.map((g) => ({
    schoolId: school.id, to: g.phone, kind: "fees", senderId: school.branding.smsSenderId,
    body: reminderBody(school.name, cfg, balance.get(g.sid) ?? 0),
  })));
  const at = new Date();
  await db.update(schools).set({
    settings: { ...(school.settings as Record<string, unknown>), feeRemindersSent: { at: at.toISOString(), n: gs.length } },
  }).where(eq(schools.id, school.id));
  invalidateSchool(slug);
  touch();
  redirect(withFlash(back, `Sent at ${at.toTimeString().slice(0, 5)} to ${gs.length} parent${gs.length === 1 ? "" : "s"}.`));
}
