import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { InvoiceDoc, ReceiptDoc } from "./docs";
import { amountInWords } from "./docs";
import { ghs } from "./config";

/* The PDF twins of the paper pages: same branding, same lines, same safety
 * notice — what a parent opens from email is exactly what prints at the
 * office. Layout rules that keep it stable everywhere:
 *   · every text block is flex-bounded so long school names/mottos WRAP
 *     instead of pushing the page sideways;
 *   · images are pre-fetched to bytes (PNG/JPEG only) and drawn inside
 *     fixed frames — a broken or unsupported image simply doesn't draw;
 *   · the footer is `fixed`, so a long invoice paginates cleanly. */

type Img = { data: Buffer; format: "png" | "jpg" } | null;

/** Fetch an image for the PDF; anything react-pdf can't draw becomes null. */
async function fetchImage(url: string | null): Promise<Img> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    const data = Buffer.from(await res.arrayBuffer());
    if (ct.includes("png") || url.split("?")[0].toLowerCase().endsWith(".png"))
      return { data, format: "png" };
    if (ct.includes("jpeg") || ct.includes("jpg") || /\.(jpe?g)$/i.test(url.split("?")[0]))
      return { data, format: "jpg" };
    // webp & friends: skip rather than break the paper
    return null;
  } catch {
    return null;
  }
}

const s = StyleSheet.create({
  page: { padding: 42, fontSize: 10.5, fontFamily: "Helvetica", color: "#111" },
  brandRow: { flexDirection: "row", alignItems: "center", paddingBottom: 12, borderBottomWidth: 3 },
  logoFrame: { width: 50, height: 50, marginRight: 12, alignItems: "center", justifyContent: "center" },
  logo: { maxWidth: 50, maxHeight: 50, objectFit: "contain" },
  brandText: { flexGrow: 1, flexShrink: 1, flexBasis: 0 }, // long names WRAP here
  photoFrame: { width: 58, height: 70, marginLeft: 12, borderWidth: 1, borderColor: "#bbb", overflow: "hidden" },
  photo: { width: 58, height: 70, objectFit: "cover" },
  schoolName: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  motto: { fontSize: 9, color: "#555", fontFamily: "Helvetica-Oblique" },
  addr: { fontSize: 8, color: "#777", marginTop: 2 },
  docTitle: { textAlign: "center", fontFamily: "Helvetica-Bold", fontSize: 11.5, letterSpacing: 2, marginTop: 14 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", columnGap: 10, rowGap: 3, marginTop: 8 },
  metaItem: { flexShrink: 1, maxWidth: "100%" },
  th: { fontFamily: "Helvetica-Bold", fontSize: 8.5, textTransform: "uppercase", letterSpacing: 0.5 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#ddd", paddingVertical: 4.5, paddingHorizontal: 6 },
  cellL: { flexGrow: 1, flexShrink: 1, flexBasis: 0, paddingRight: 6 },
  cellR: { width: 90, textAlign: "right", flexShrink: 0 },
  note: { marginTop: 14, borderWidth: 1.2, borderColor: "#b45309", borderRadius: 4, padding: 9, fontSize: 8.5, lineHeight: 1.5 },
  foot: { position: "absolute", bottom: 24, left: 42, right: 42, textAlign: "center", fontSize: 7.5, color: "#999", borderTopWidth: 0.5, borderColor: "#ddd", paddingTop: 6 },
});

function BrandHeader({ d, color, photo }: {
  d: { school: InvoiceDoc["school"] }; color: string;
  photo?: { logo: Img; student?: Img };
}) {
  const b = d.school.branding;
  return (
    <View style={[s.brandRow, { borderColor: color }]}>
      {photo?.logo && (
        <View style={s.logoFrame}>
          <Image src={photo.logo} style={s.logo} />
        </View>
      )}
      <View style={s.brandText}>
        <Text style={[s.schoolName, { color }]}>{d.school.name}</Text>
        {b.motto ? <Text style={s.motto}>{b.motto}</Text> : null}
        <Text style={s.addr}>{[b.address, b.phone, b.email].filter(Boolean).join("  ·  ")}</Text>
      </View>
      {photo?.student && (
        <View style={s.photoFrame}>
          <Image src={photo.student} style={s.photo} />
        </View>
      )}
    </View>
  );
}

function SafetyNote({ cfg }: { cfg: InvoiceDoc["cfg"] }) {
  return (
    <View style={s.note} wrap={false}>
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

export function InvoicePdf({ d, logo, student }: { d: InvoiceDoc; logo: Img; student: Img }) {
  const color = d.school.branding.primaryColor || "#5E1D3E";
  return (
    <Document title={`${d.invoice.invoiceNo ?? "Invoice"} — ${d.student.firstName} ${d.student.lastName}`}>
      <Page size="A4" style={s.page}>
        <BrandHeader d={d} color={color} photo={{ logo, student }} />
        <Text style={s.docTitle}>FEE INVOICE — {d.termName.toUpperCase()}, {d.yearName}</Text>
        <View style={s.metaRow}>
          <Text style={s.metaItem}><Text style={s.th}>Invoice No:  </Text>{d.invoice.invoiceNo ?? "—"}</Text>
          <Text style={s.metaItem}><Text style={s.th}>Issued:  </Text>{d.invoice.createdAt.toISOString().slice(0, 10)}</Text>
          <Text style={s.metaItem}><Text style={s.th}>Due:  </Text>{d.invoice.dueDate ?? "—"}</Text>
        </View>
        <View style={[s.metaRow, { marginBottom: 10 }]}>
          <Text style={s.metaItem}><Text style={s.th}>Student:  </Text>{d.student.firstName} {d.student.lastName}</Text>
          <Text style={s.metaItem}><Text style={s.th}>Class:  </Text>{d.className ?? "—"}</Text>
          <Text style={s.metaItem}><Text style={s.th}>Admission No:  </Text>{d.student.admissionNo}</Text>
        </View>
        <View style={[s.row, { backgroundColor: color }]}>
          <Text style={[s.cellL, s.th, { color: "#fff" }]}>Item</Text>
          <Text style={[s.cellR, s.th, { color: "#fff" }]}>Amount (GHS)</Text>
        </View>
        {d.lines.map((l) => (
          <View key={l.id} style={s.row} wrap={false}>
            <Text style={s.cellL}>{l.label}{l.source === "carry_forward" ? "  (previous term)" : ""}</Text>
            <Text style={s.cellR}>{(l.amountPesewas / 100).toFixed(2)}</Text>
          </View>
        ))}
        <View style={[s.row, { backgroundColor: "#f6f0f4" }]} wrap={false}>
          <Text style={[s.cellL, { fontFamily: "Helvetica-Bold" }]}>Total</Text>
          <Text style={[s.cellR, { fontFamily: "Helvetica-Bold" }]}>{(d.invoice.totalPesewas / 100).toFixed(2)}</Text>
        </View>
        <View style={s.row} wrap={false}>
          <Text style={s.cellL}>Paid to date</Text>
          <Text style={s.cellR}>{(d.invoice.paidPesewas / 100).toFixed(2)}</Text>
        </View>
        <View style={[s.row, { backgroundColor: color }]} wrap={false}>
          <Text style={[s.cellL, { fontFamily: "Helvetica-Bold", color: "#fff" }]}>BALANCE DUE</Text>
          <Text style={[s.cellR, { fontFamily: "Helvetica-Bold", color: "#fff" }]}>
            {(Math.max(0, d.invoice.totalPesewas - d.invoice.paidPesewas) / 100).toFixed(2)}
          </Text>
        </View>
        <SafetyNote cfg={d.cfg} />
        <Text style={s.foot} fixed>
          Generated for {d.school.name} · Peysich · Issued {d.invoice.createdAt.toISOString().slice(0, 10)} — the lines above will not change.
        </Text>
      </Page>
    </Document>
  );
}

export function ReceiptPdf({ d, logo, stamp }: { d: ReceiptDoc; logo: Img; stamp: Img }) {
  const color = d.school.branding.primaryColor || "#5E1D3E";
  const p = d.payment;
  const Row = ({ k, v, bold }: { k: string; v: string; bold?: boolean }) => (
    <View style={{ flexDirection: "row", marginBottom: 5 }}>
      <Text style={[s.th, { width: 105, flexShrink: 0, paddingTop: 1 }]}>{k}</Text>
      <Text style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, fontFamily: bold ? "Helvetica-Bold" : "Helvetica" }}>{v}</Text>
    </View>
  );
  return (
    <Document title={`Receipt ${p.receiptNo ?? ""} — ${d.student.firstName} ${d.student.lastName}`}>
      <Page size="A5" style={[s.page, { padding: 30 }]}>
        <BrandHeader d={d} color={color} photo={{ logo }} />
        <View style={[s.metaRow, { marginTop: 10 }]}>
          <Text style={{ fontFamily: "Helvetica-Bold", letterSpacing: 1.5 }}>OFFICIAL RECEIPT</Text>
          <Text style={{ fontFamily: "Helvetica-Bold", color, fontSize: 12 }}>No. {p.receiptNo ?? p.reference}</Text>
        </View>
        {p.voidedAt ? (
          <Text style={{ marginTop: 6, color: "#dc2626", fontFamily: "Helvetica-Bold", letterSpacing: 2 }}>
            VOID — this receipt was cancelled on {p.voidedAt.toISOString().slice(0, 10)}
          </Text>
        ) : null}
        <View style={{ marginTop: 12 }}>
          <Row k="Date" v={p.createdAt.toISOString().slice(0, 10)} />
          <Row k="For student" v={`${d.student.firstName} ${d.student.lastName} — ${d.className ?? "—"} · ${d.student.admissionNo}`} />
          <Row k="Amount" v={ghs(p.amountPesewas)} bold />
          <Row k="In words" v={amountInWords(p.amountPesewas)} />
          <Row k="Payment for" v={`${d.termName} fees, ${d.yearName}`} />
          <Row k="Method" v={`${p.method}${p.reference && !p.reference.startsWith("pay_") ? ` · ref ${p.reference}` : ""}`} />
          <Row k="Balance after" v={ghs(Math.max(0, d.balanceAfter))} bold />
        </View>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 16 }} wrap={false}>
          <View style={{ width: "42%" }}>
            <View style={{ height: 42 }} />
            <View style={{ borderTopWidth: 0.8, borderColor: "#888", paddingTop: 3 }}>
              <Text style={{ textAlign: "center", fontSize: 8.5, color: "#555" }}>Received by — {d.recordedByName}</Text>
            </View>
          </View>
          <View style={{ width: "42%" }}>
            <View style={{ height: 42, alignItems: "center", justifyContent: "flex-end" }}>
              {stamp && <Image src={stamp} style={{ maxHeight: 40, maxWidth: 90, objectFit: "contain" }} />}
            </View>
            <View style={{ borderTopWidth: 0.8, borderColor: "#888", paddingTop: 3 }}>
              <Text style={{ textAlign: "center", fontSize: 8.5, color: "#555" }}>School stamp</Text>
            </View>
          </View>
        </View>
        <Text style={[s.foot, { left: 30, right: 30 }]} fixed>
          Thank you. Keep this receipt — it is your proof of payment. · Peysich
        </Text>
      </Page>
    </Document>
  );
}

export async function invoicePdfBuffer(d: InvoiceDoc) {
  const [logo, student] = await Promise.all([fetchImage(d.logoUrl), fetchImage(d.photoUrl)]);
  return renderToBuffer(<InvoicePdf d={d} logo={logo} student={student} />);
}
export async function receiptPdfBuffer(d: ReceiptDoc) {
  const [logo, stamp] = await Promise.all([fetchImage(d.logoUrl), fetchImage(d.stampUrl)]);
  return renderToBuffer(<ReceiptPdf d={d} logo={logo} stamp={stamp} />);
}
