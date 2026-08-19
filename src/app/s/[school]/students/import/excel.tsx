"use client";
import { useState } from "react";
import * as XLSX from "xlsx";
import { Card, btnCls, btnGhostCls } from "@/ui/kit";
import { importStudentRows, type ImportRow } from "./actions";

/** Header → internal key. The template writes these exact headers; upload
 *  matches them case-insensitively so hand-edited sheets still work. */
const COLUMNS: [string, keyof ImportRow, string][] = [
  ["First Name *", "firstName", "Required."],
  ["Last Name *", "lastName", "Required."],
  ["Other Names", "otherNames", "Optional middle names."],
  ["Sex *", "sex", "male or female (m/f accepted)."],
  ["Date of Birth", "dob", "YYYY-MM-DD, e.g. 2016-03-24."],
  ["Class *", "className", "EXACT class name from the Classes sheet."],
  ["Admission No", "admissionNo", "Leave blank to auto-generate (ADM0001…)."],
  ["Admission Date", "admittedOn", "YYYY-MM-DD. Blank = today."],
  ["Boarder (yes/no)", "boarder", "yes = boarder, blank/no = day student."],
  ["National ID / Birth Cert No", "idNumber", "Ghana Card or birth certificate number."],
  ["Place of Birth", "placeOfBirth", ""],
  ["Nationality", "nationality", "e.g. Ghanaian."],
  ["Hometown", "hometown", ""],
  ["Religion", "religion", ""],
  ["Address", "address", "Residential address."],
  ["Previous School", "previousSchool", "Name + last grade completed."],
  ["Blood Group", "bloodGroup", "A+, A-, B+, B-, AB+, AB-, O+, O-."],
  ["Medical Notes", "medicalNotes", "Allergies, conditions, medication."],
  ["Guardian Name", "guardianName", "Primary parent/guardian full name."],
  ["Guardian Phone", "guardianPhone", "Required if guardian name is given. Same phone across siblings links ONE parent."],
  ["Guardian Relation", "guardianRelation", "mother, father, aunt… (default parent)."],
  ["Guardian Occupation", "guardianOccupation", ""],
  ["Guardian Email", "guardianEmail", ""],
  ["Emergency Name", "emergencyName", "Backup contact + relation."],
  ["Emergency Phone", "emergencyPhone", ""],
  ["Payment Note", "paymentNote", "How/where this family pays fees."],
];

function buildTemplate(schoolName: string, classNames: string[]) {
  const wb = XLSX.utils.book_new();
  const students = XLSX.utils.aoa_to_sheet([
    COLUMNS.map(([h]) => h),
    ["Ama", "Mensah", "", "female", "2016-03-24", classNames[0] ?? "Basic 4 A", "", "", "no",
      "GHA-000000000-0", "Kumasi", "Ghanaian", "Ejisu", "", "House 12, Ahodwo", "Sunrise Academy — B3",
      "O+", "No groundnuts", "Akosua Mensah", "0241234567", "mother", "Trader", "",
      "Uncle — Kofi Mensah", "0209876543", "Pays via MoMo, week 2 of term"],
  ]);
  students["!cols"] = COLUMNS.map(([h]) => ({ wch: Math.max(14, h.length + 2) }));
  XLSX.utils.book_append_sheet(wb, students, "Students");

  const rules = XLSX.utils.aoa_to_sheet([
    [`Peysich student collection sheet — ${schoolName}`],
    ["Fill ONE ROW PER STUDENT on the Students sheet. Row 2 is an example — replace it."],
    ["Columns marked * are required. Dates must be typed as YYYY-MM-DD."],
    [],
    ["Column", "Rule"],
    ...COLUMNS.map(([h, , rule]) => [h, rule]),
  ]);
  rules["!cols"] = [{ wch: 30 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, rules, "Rules");

  const clsSheet = XLSX.utils.aoa_to_sheet([
    ["Valid class names (copy EXACTLY into the Class column)"],
    ...classNames.map((n) => [n]),
  ]);
  clsSheet["!cols"] = [{ wch: 40 }];
  XLSX.utils.book_append_sheet(wb, clsSheet, "Classes");
  XLSX.writeFile(wb, `peysich-students-${schoolName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.xlsx`);
}

type Result = { imported: number; errors: string[] } | { error: string };

export function ExcelImport({ slug, schoolName, classNames }: {
  slug: string; schoolName: string; classNames: string[];
}) {
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [preErrors, setPreErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const validClasses = new Set(classNames.map((n) => n.trim().toLowerCase()));

  async function parseFile(file: File) {
    setResult(null);
    const wb = XLSX.read(await file.arrayBuffer(), { cellDates: false });
    const sheet = wb.Sheets["Students"] ?? wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { raw: false, defval: "" });
    const headerKey = new Map(COLUMNS.map(([h, k]) => [h.toLowerCase().replace(/\s*\*\s*$/, "").trim(), k]));
    const mapped: ImportRow[] = raw.map((r) => {
      const out = {} as Record<string, string>;
      for (const [h, v] of Object.entries(r)) {
        const k = headerKey.get(h.toLowerCase().replace(/\s*\*\s*$/, "").trim());
        if (k) out[k] = String(v).trim();
      }
      return out as ImportRow;
    }).filter((r) => r.firstName || r.lastName); // skip fully blank rows
    // client-side pre-check so field teams see problems before submitting
    const errs: string[] = [];
    mapped.forEach((r, i) => {
      const line = i + 2;
      if (!r.firstName || !r.lastName) errs.push(`Row ${line}: missing first/last name`);
      if (!/^(m|male|f|female)$/i.test((r.sex ?? "").trim())) errs.push(`Row ${line}: sex must be male or female`);
      if (!validClasses.has((r.className ?? "").trim().toLowerCase()))
        errs.push(`Row ${line}: class "${r.className || "(blank)"}" is not on the Classes sheet`);
    });
    setFileName(file.name); setRows(mapped); setPreErrors(errs);
  }

  return (
    <div className="space-y-5">
      <Card>
        <h2 className="font-semibold">1 · Download the collection sheet</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          An Excel workbook with every column the student file needs, the rules for each column,
          and this school&apos;s exact class names. Take it to the school, fill one row per student.
        </p>
        <button onClick={() => buildTemplate(schoolName, classNames)} className={btnGhostCls + " mt-3"}>
          Download template (.xlsx)
        </button>
      </Card>

      <Card>
        <h2 className="font-semibold">2 · Upload the filled sheet</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Rows are checked before anything is written — broken rows are listed with their Excel row number.
        </p>
        <input type="file" accept=".xlsx,.xls,.csv" className="mt-3 block text-sm"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f); }} />

        {rows && (
          <div className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-sm">
            <p><span className="font-medium">{fileName}</span> — {rows.length} students found.</p>
            {preErrors.length > 0 && (
              <div className="mt-2">
                <p className="font-medium text-danger">{preErrors.length} rows need fixing (they will be skipped):</p>
                <ul className="mt-1 max-h-40 list-inside list-disc overflow-y-auto text-[13px] text-danger">
                  {preErrors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
            <button disabled={busy || rows.length === 0} className={btnCls + " mt-3"}
              onClick={async () => {
                setBusy(true);
                setResult(await importStudentRows(slug, rows));
                setBusy(false);
              }}>
              {busy ? "Importing…" : `Import ${rows.length} students`}
            </button>
          </div>
        )}

        {result && "error" in result && <p className="mt-3 text-sm text-danger">{result.error}</p>}
        {result && "imported" in result && (
          <div className="mt-3 text-sm">
            <p className="font-medium text-success">✓ Imported {result.imported} students — they are live on the roster.</p>
            {result.errors.length > 0 && (
              <>
                <p className="mt-2 font-medium text-danger">{result.errors.length} rows were skipped:</p>
                <ul className="mt-1 max-h-40 list-inside list-disc overflow-y-auto text-[13px] text-danger">
                  {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Fix those rows in the sheet and upload again — already-imported students are skipped by admission number.
                </p>
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
