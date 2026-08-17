"use client";
import { useState, useTransition } from "react";
import { saveGradingScheme } from "../actions-grading";
import { Card, btnCls, inputCls } from "@/ui/kit";

type Band = { min: number; grade: string; remark: string };

/** Grading scheme editor: CA/exam weights + editable grade bands. */
export function GradingEditor({ slug, caWeight, examWeight, bands }: {
  slug: string; caWeight: number; examWeight: number; bands: Band[];
}) {
  const [ca, setCa] = useState(caWeight);
  const [rows, setRows] = useState<Band[]>(bands);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const set = (i: number, k: keyof Band, v: string) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, [k]: k === "min" ? Number(v) : v } : r)));

  return (
    <Card>
      <h2 className="font-semibold">Grading scheme</h2>
      <div className="mt-3 flex items-center gap-3 text-sm">
        <label>Class score (CA)</label>
        <input type="number" min={0} max={100} value={ca}
          onChange={(e) => setCa(Number(e.target.value))} className={inputCls + " w-20"} />
        <span>%</span>
        <span className="text-muted-foreground">+ Exam {100 - ca}% = 100%</span>
      </div>
      <table className="mt-3 w-full text-sm">
        <thead><tr className="text-left text-xs text-muted-foreground">
          <th className="py-1">From score</th><th>Grade</th><th>Remark</th><th /></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="py-1 pr-2"><input type="number" value={r.min} onChange={(e) => set(i, "min", e.target.value)} className={inputCls + " w-20"} /></td>
              <td className="pr-2"><input value={r.grade} onChange={(e) => set(i, "grade", e.target.value)} className={inputCls + " w-16"} /></td>
              <td className="pr-2"><input value={r.remark} onChange={(e) => set(i, "remark", e.target.value)} className={inputCls} /></td>
              <td><button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))}
                className="text-xs text-danger">remove</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={() => setRows([...rows, { min: 0, grade: "", remark: "" }])}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">Add band</button>
        <button disabled={pending} className={btnCls}
          onClick={() => start(async () => {
            const r = await saveGradingScheme(slug, ca, rows);
            setMsg(r && "error" in r ? r.error! : "Saved ✓");
          })}>
          {pending ? "Saving…" : "Save scheme"}
        </button>
        {msg && <span className="text-sm text-success">{msg}</span>}
      </div>
    </Card>
  );
}
