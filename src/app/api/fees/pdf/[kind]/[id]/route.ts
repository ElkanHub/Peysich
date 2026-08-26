import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { schools } from "@/db/schema";
import { getSession } from "@/core/session";
import { assertParentOf } from "@/core/portal";
import { getAdminGrants } from "@/core/access";
import { loadInvoiceDoc, loadReceiptDoc } from "@/modules/fees/docs";
import { invoicePdfBuffer, receiptPdfBuffer } from "@/modules/fees/pdf";

export const runtime = "nodejs";

/** Fee papers as real PDFs — the same document the page shows and the email
 *  attaches. Auth: the school's admins (with the fees tab) and the child's
 *  own guardians. Students never see money documents. */
export async function GET(req: NextRequest, { params }: {
  params: Promise<{ kind: string; id: string }>;
}) {
  const { kind, id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const user = session.user as { id: string; role: string; schoolId?: string | null };
  if (!user.schoolId) return NextResponse.json({ error: "No school" }, { status: 403 });
  const [school] = await db.select().from(schools).where(eq(schools.id, user.schoolId));
  if (!school) return NextResponse.json({ error: "No school" }, { status: 404 });

  const authorize = async (studentId: string) => {
    if (user.role === "admin") {
      const g = await getAdminGrants(school.id, user.id);
      return !g || g.tabs.has("fees");
    }
    if (user.role === "parent") return assertParentOf(school.id, user.id, studentId);
    return false;
  };

  if (kind === "invoice") {
    const d = await loadInvoiceDoc(school, id);
    if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!(await authorize(d.student.id))) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    const buf = await invoicePdfBuffer(d);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${(d.invoice.invoiceNo ?? "invoice").replace(/\s/g, "-")}-${d.student.lastName}.pdf"`,
      },
    });
  }
  if (kind === "receipt") {
    const d = await loadReceiptDoc(school, id);
    if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!(await authorize(d.student.id))) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    const buf = await receiptPdfBuffer(d);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="receipt-${(d.payment.receiptNo ?? "payment").replace(/\s/g, "-")}.pdf"`,
      },
    });
  }
  return NextResponse.json({ error: "Unknown document" }, { status: 400 });
}
