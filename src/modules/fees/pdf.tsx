import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { InvoiceDoc, ReceiptDoc } from "./docs";
import { amountInWords } from "./docs";
import { ghs } from "./config";

/* The PDF twins of the paper pages: same branding, same lines, same safety
 * notice — what a parent opens from email is exactly what prints at the
 * office. Rendered server-side, no browser involved. */

const s = StyleSheet.create({
  page: { padding: 42, fontSize: 10.5, fontFamily: "Helvetica", color: "#111" },
  brandRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingBottom: 12, borderBottomWidth: 3 },
  logo: { width: 52, height: 52, objectFit: "contain" },
  photo: { width: 56, height: 66, marginLeft: "auto", objectFit: "cover", borderWidth: 1, borderColor: "#bbb" },
  schoolName: { fontSize: 17, fontFamily: "Helvetica-Bold" },
  motto: { fontSize: 9, color: "#555", fontFamily: "Helvetica-Oblique" },
  addr: { fontSize: 8, color: "#777", marginTop: 2 },
  docTitle: { textAlign: "center", fontFamily: "Helvetica-Bold", fontSize: 11.5, letterSpacing: 2, marginTop: 14 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  th: { fontFamily: "Helvetica-Bold", fontSize: 8.5, textTransform: "uppercase", letterSpacing: 0.5 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#ddd", paddingVertical: 4.5, paddingHorizontal: 6 },
  cellL: { flex: 1 }, cellR: { width: 90, textAlign: "right" },
  note: { marginTop: 14, borderWidth: 1.2, borderColor: "#b45309", borderRadius: 4, padding: 9, fontSize: 8.5, lineHeight: 1.5 },
  foot: { position: "absolute", bottom: 26, left: 42, right: 42, textAlign: "center", fontSize: 7.5, color: "#999", borderTopWidth: 0.5, borderColor: "#ddd", paddingTop: 6 },
});

function BrandHeader({ d, color }: { d: { school: InvoiceDoc["school"]; logoUrl: string | null }; color: string }) {
  const b = d.school.branding;
  return (
    <View style={[s.brandRow, { borderColor: color }]}>
      {d.logoUrl ? <Image src={d.logoUrl} style={s.logo} /> : null}
      <View>
        <Text style={[s.schoolName, { color }]}>{d.school.name}</Text>
        {b.motto ? <Text style={s.motto}>{b.motto}</Text> : null}
        <Text style={s.addr}>{[b.address, b.phone, b.email].filter(Boolean).join("  ·  ")}</Text>
      </View>
    </View>
  );
}

function SafetyNote({ cfg }: { cfg: InvoiceDoc["cfg"] }) {
  return (
    <View style={s.note}>
      <Text style={{ fontFamily: "Helvetica-Bold", color: "#b45309", marginBottom: 3 }}>HOW TO PAY</Text>
      {cfg.channelsText
        ? cfg.channelsText.split("\n").filter(Boolean).map((l, i) => <Text key={i}>{l}</Text>)
        : <Text>Please pay at the school office.</Text>}
      <Text style={{ marginTop: 5, fontFamily: "Helvetica-Bold" }}>
        Confirm before sending: verify any payment number with the school
        {cfg.confirmPhone ? ` on ${cfg.confirmPhone}` : ""} before you transfer.
        The school never changes its numbers by SMS.
      </Text>
    </View>
  );
}

export function InvoicePdf({ d }: { d: InvoiceDoc }) {
  const color = d.school.branding.primaryColor || "#5E1D3E";
  const fmt = (iso: string | null) => iso ?? "—";
  return (
    <Document title={`${d.invoice.invoiceNo ?? "Invoice"} — ${d.student.firstName} ${d.student.lastName}`}>
      <Page size="A4" style={s.page}>
        {d.photoUrl ? <Image src={d.photoUrl} style={[s.photo, { position: "absolute", right: 42, top: 42 }]} /> : null}
        <BrandHeader d={d} color={color} />
        <Text style={s.docTitle}>FEE INVOICE — {d.termName.toUpperCase()}, {d.yearName}</Text>
        <View style={s.metaRow}>
          <Text><Text style={s.th}>Invoice No:  </Text>{d.invoice.invoiceNo ?? "—"}</Text>
          <Text><Text style={s.th}>Issued:  </Text>{d.invoice.createdAt.toISOString().slice(0, 10)}</Text>
          <Text><Text style={s.th}>Due:  </Text>{fmt(d.invoice.dueDate)}</Text>
        </View>
        <View style={[s.metaRow, { marginBottom: 10 }]}>
          <Text><Text style={s.th}>Student:  </Text>{d.student.firstName} {d.student.lastName}</Text>
          <Text><Text style={s.th}>Class:  </Text>{d.className ?? "—"}</Text>
          <Text><Text style={s.th}>Admission No:  </Text>{d.student.admissionNo}</Text>
        </View>
        <View style={[s.row, { backgroundColor: color }]}>
          <Text style={[s.cellL, s.th, { color: "#fff" }]}>Item</Text>
          <Text style={[s.cellR, s.th, { color: "#fff" }]}>Amount (GHS)</Text>
        </View>
        {d.lines.map((l) => (
          <View key={l.id} style={s.row}>
            <Text style={s.cellL}>{l.label}{l.source === "carry_forward" ? "  (previous term)" : ""}</Text>
            <Text style={s.cellR}>{(l.amountPesewas / 100).toFixed(2)}</Text>
          </View>
        ))}
        <View style={[s.row, { backgroundColor: "#f6f0f4" }]}>
          <Text style={[s.cellL, { fontFamily: "Helvetica-Bold" }]}>Total</Text>
          <Text style={[s.cellR, { fontFamily: "Helvetica-Bold" }]}>{(d.invoice.totalPesewas / 100).toFixed(2)}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.cellL}>Paid to date</Text>
          <Text style={s.cellR}>{(d.invoice.paidPesewas / 100).toFixed(2)}</Text>
        </View>
        <View style={[s.row, { backgroundColor: color }]}>
          <Text style={[s.cellL, { fontFamily: "Helvetica-Bold", color: "#fff" }]}>BALANCE DUE</Text>
          <Text style={[s.cellR, { fontFamily: "Helvetica-Bold", color: "#fff" }]}>
            {(Math.max(0, d.invoice.totalPesewas - d.invoice.paidPesewas) / 100).toFixed(2)}
          </Text>
        </View>
        <SafetyNote cfg={d.cfg} />
        <Text style={s.foot}>
          Generated for {d.school.name} · Peysich · Issued {d.invoice.createdAt.toISOString().slice(0, 10)} — the lines above will not change.
        </Text>
      </Page>
    </Document>
  );
}

export function ReceiptPdf({ d }: { d: ReceiptDoc }) {
  const color = d.school.branding.primaryColor || "#5E1D3E";
  const p = d.payment;
  return (
    <Document title={`Receipt ${p.receiptNo ?? ""} — ${d.student.firstName} ${d.student.lastName}`}>
      <Page size="A5" style={[s.page, { padding: 32 }]}>
        <BrandHeader d={d} color={color} />
        <View style={[s.metaRow, { marginTop: 10 }]}>
          <Text style={{ fontFamily: "Helvetica-Bold", letterSpacing: 1.5 }}>OFFICIAL RECEIPT</Text>
          <Text style={{ fontFamily: "Helvetica-Bold", color, fontSize: 12 }}>No. {p.receiptNo ?? p.reference}</Text>
        </View>
        {p.voidedAt ? (
          <Text style={{ marginTop: 6, color: "#dc2626", fontFamily: "Helvetica-Bold", letterSpacing: 2 }}>
            VOID — this receipt was cancelled on {p.voidedAt.toISOString().slice(0, 10)}
          </Text>
        ) : null}
        <View style={{ marginTop: 12, gap: 5 }}>
          <Text><Text style={s.th}>Date:  </Text>{p.createdAt.toISOString().slice(0, 10)}</Text>
          <Text><Text style={s.th}>For student:  </Text>{d.student.firstName} {d.student.lastName} — {d.className ?? "—"} · {d.student.admissionNo}</Text>
          <Text style={{ fontSize: 13, marginVertical: 2 }}>
            <Text style={s.th}>Amount:  </Text>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{ghs(p.amountPesewas)}</Text>
          </Text>
          <Text><Text style={s.th}>In words:  </Text>{amountInWords(p.amountPesewas)}</Text>
          <Text><Text style={s.th}>Payment for:  </Text>{d.termName} fees, {d.yearName}</Text>
          <Text><Text style={s.th}>Method:  </Text>{p.method}{p.reference && !p.reference.startsWith("pay_") ? ` · ref ${p.reference}` : ""}</Text>
          <Text style={{ marginTop: 4, fontFamily: "Helvetica-Bold" }}>
            Balance after this payment: {ghs(Math.max(0, d.balanceAfter))}
          </Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 40 }}>
          <View style={{ width: "42%", borderTopWidth: 0.8, borderColor: "#888", paddingTop: 3 }}>
            <Text style={{ textAlign: "center", fontSize: 8.5, color: "#555" }}>Received by — {d.recordedByName}</Text>
          </View>
          <View style={{ width: "42%", borderTopWidth: 0.8, borderColor: "#888", paddingTop: 3 }}>
            <Text style={{ textAlign: "center", fontSize: 8.5, color: "#555" }}>School stamp</Text>
          </View>
        </View>
        <Text style={[s.foot, { left: 32, right: 32 }]}>
          Thank you. Keep this receipt — it is your proof of payment. · Peysich
        </Text>
      </Page>
    </Document>
  );
}

export async function invoicePdfBuffer(d: InvoiceDoc) {
  return renderToBuffer(<InvoicePdf d={d} />);
}
export async function receiptPdfBuffer(d: ReceiptDoc) {
  return renderToBuffer(<ReceiptPdf d={d} />);
}
