import { eq } from "drizzle-orm";
import { db } from "@/db";
import { schools } from "@/db/schema";

/** A paper that travels with a message: the PDF, built at send time from the
 *  live record so the attachment is always the document as it stands. */
export type Doc = { kind: "invoice" | "receipt"; id: string; name: string };

export async function docBuffer(schoolId: string, doc: Doc): Promise<Buffer | null> {
  const [school] = await db.select().from(schools).where(eq(schools.id, schoolId));
  if (!school) return null;
  const { loadInvoiceDoc, loadReceiptDoc } = await import("@/modules/fees/docs");
  const { invoicePdfBuffer, receiptPdfBuffer } = await import("@/modules/fees/pdf");
  if (doc.kind === "invoice") { const d = await loadInvoiceDoc(school, doc.id); return d ? invoicePdfBuffer(d) : null; }
  const d = await loadReceiptDoc(school, doc.id); return d ? receiptPdfBuffer(d) : null;
}
