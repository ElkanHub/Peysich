import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  feeInvoices, feeInvoiceLines, feePayments, students, classes, terms,
  academicYears, guardians, studentGuardians,
} from "@/db/schema";
import { r2Enabled, presignDownload } from "@/lib/r2";
import { getFeesConfig, type FeesConfig } from "./config";

/* One loader per paper. The page, the PDF and the email all read the SAME
 * shape, so the parent's screen, the printout and the attachment can never
 * disagree. */

export type InvoiceDoc = {
  invoice: typeof feeInvoices.$inferSelect;
  lines: (typeof feeInvoiceLines.$inferSelect)[];
  student: typeof students.$inferSelect;
  className: string | null;
  termName: string; yearName: string;
  school: { name: string; branding: { motto?: string; address?: string; phone?: string; email?: string; primaryColor?: string } };
  cfg: FeesConfig;
  logoUrl: string | null; photoUrl: string | null;
};

export async function loadInvoiceDoc(school: {
  id: string; name: string;
  branding: InvoiceDoc["school"]["branding"] & { logoUrl?: string };
  settings: unknown;
}, invoiceId: string): Promise<InvoiceDoc | null> {
  const [inv] = await db.select().from(feeInvoices).where(and(
    eq(feeInvoices.id, invoiceId), eq(feeInvoices.schoolId, school.id)));
  if (!inv) return null;
  const [lines, [s], [t]] = await Promise.all([
    db.select().from(feeInvoiceLines)
      .where(eq(feeInvoiceLines.invoiceId, inv.id)).orderBy(feeInvoiceLines.sortOrder),
    db.select().from(students).where(eq(students.id, inv.studentId)),
    db.select().from(terms).where(eq(terms.id, inv.termId)),
  ]);
  if (!s || !t) return null;
  const [[y], [cls]] = await Promise.all([
    db.select().from(academicYears).where(eq(academicYears.id, t.yearId)),
    s.classId ? db.select().from(classes).where(eq(classes.id, s.classId)) : Promise.resolve([null]),
  ]);
  const [logoUrl, photoUrl] = await Promise.all([
    school.branding.logoUrl && r2Enabled ? presignDownload(school.branding.logoUrl) : null,
    s.photoUrl && r2Enabled ? presignDownload(s.photoUrl) : null,
  ]);
  return {
    invoice: inv, lines, student: s, className: cls?.name ?? null,
    termName: t.name, yearName: y?.name ?? "",
    school: { name: school.name, branding: school.branding },
    cfg: getFeesConfig(school.settings),
    logoUrl, photoUrl,
  };
}

export type ReceiptDoc = {
  payment: typeof feePayments.$inferSelect;
  invoice: typeof feeInvoices.$inferSelect;
  student: typeof students.$inferSelect;
  className: string | null;
  termName: string; yearName: string;
  balanceAfter: number;
  recordedByName: string;
  school: InvoiceDoc["school"];
  cfg: FeesConfig;
  logoUrl: string | null;
};

export async function loadReceiptDoc(school: Parameters<typeof loadInvoiceDoc>[0], paymentId: string): Promise<ReceiptDoc | null> {
  const [p] = await db.select().from(feePayments).where(and(
    eq(feePayments.id, paymentId), eq(feePayments.schoolId, school.id)));
  if (!p) return null;
  const inv = await loadInvoiceDoc(school, p.invoiceId);
  if (!inv) return null;
  // balance after THIS payment: sum of payments up to and including it
  const pays = await db.select().from(feePayments)
    .where(eq(feePayments.invoiceId, p.invoiceId));
  const upTo = pays
    .filter((x) => !x.voidedAt && x.createdAt <= p.createdAt)
    .reduce((a, x) => a + x.amountPesewas, 0);
  const { user: userTable } = await import("@/db/schema");
  const [rec] = p.recordedBy
    ? await db.select({ name: userTable.name }).from(userTable).where(eq(userTable.id, p.recordedBy))
    : [null];
  return {
    payment: p, invoice: inv.invoice, student: inv.student, className: inv.className,
    termName: inv.termName, yearName: inv.yearName,
    balanceAfter: inv.invoice.totalPesewas - upTo,
    recordedByName: rec?.name ?? "School office",
    school: inv.school, cfg: inv.cfg, logoUrl: inv.logoUrl,
  };
}

/** Guardian emails for a student (for "Email to guardian"). */
export async function guardianEmailsFor(schoolId: string, studentId: string) {
  const rows = await db.select({ email: guardians.email, name: guardians.name })
    .from(studentGuardians)
    .innerJoin(guardians, eq(studentGuardians.guardianId, guardians.id))
    .where(eq(studentGuardians.studentId, studentId));
  const seen = new Set<string>();
  return rows.filter((r) => r.email && !seen.has(r.email) && seen.add(r.email)) as { email: string; name: string }[];
}

/** Amount in words for receipts — cedis and pesewas, plain English. */
export function amountInWords(pesewas: number) {
  const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  const say = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100) return `${tens[Math.floor(n / 10)]}${n % 10 ? "-" + ones[n % 10] : ""}`;
    if (n < 1000) return `${ones[Math.floor(n / 100)]} hundred${n % 100 ? " and " + say(n % 100) : ""}`;
    if (n < 1_000_000) return `${say(Math.floor(n / 1000))} thousand${n % 1000 ? ", " + say(n % 1000) : ""}`;
    return `${say(Math.floor(n / 1_000_000))} million${n % 1_000_000 ? ", " + say(n % 1_000_000) : ""}`;
  };
  const cedis = Math.floor(pesewas / 100);
  const pes = pesewas % 100;
  const c = cedis ? `${say(cedis)} cedi${cedis === 1 ? "" : "s"}` : "";
  const p2 = pes ? `${say(pes)} pesewa${pes === 1 ? "" : "s"}` : "";
  const out = [c, p2].filter(Boolean).join(", ") || "zero cedis";
  return out.charAt(0).toUpperCase() + out.slice(1);
}
