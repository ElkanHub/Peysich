"use client";
import { useState } from "react";
import { Field, inputCls } from "@/ui/kit";

/** The audience and the kind: who gets it, in which schools, and whether it
 *  is a notice (feed and phones) or a promo (the screen, on a schedule). */
export function BroadcastForm({ schools }: { schools: { id: string; name: string }[] }) {
  const [kind, setKind] = useState<"notice" | "promo">("notice");
  const [all, setAll] = useState(true);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["notice", "promo"] as const).map((k) => (
          <label key={k} className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2.5 ${kind === k ? "border-primary bg-brand-soft" : "border-border"}`}>
            <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="mt-1" />
            <span className="text-sm">
              <b className="block capitalize">{k}</b>
              <span className="text-muted-foreground">{k === "notice" ? "Lands in the announcement feed and pings the people chosen, once." : "Takes the screen when the person next opens the app, again after a while, until the end date."}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Who">
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 py-1 text-sm">
            {[["admin", "School admins"], ["teacher", "Teachers"], ["parent", "Parents"], ["student", "Students"]].map(([v, l]) => (
              <label key={v} className="flex items-center gap-1.5"><input type="checkbox" name="roles" value={v} defaultChecked={v === "admin"} /> {l}</label>
            ))}
          </div>
        </Field>
        <Field label="Which schools">
          <div className="text-sm">
            <label className="flex items-center gap-1.5"><input type="radio" name="scope" value="all" checked={all} onChange={() => setAll(true)} /> Every live school</label>
            <label className="mt-1 flex items-center gap-1.5"><input type="radio" name="scope" value="some" checked={!all} onChange={() => setAll(false)} /> Only these</label>
            {!all && (
              <select name="schoolIds" multiple size={6} className={inputCls + " mt-1.5"}>
                {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
          </div>
        </Field>
      </div>
      {kind === "promo" && (
        <div className="grid gap-3 rounded-lg bg-muted/50 p-3 sm:grid-cols-4">
          <Field label="Starts" optional><input name="startsAt" type="date" className={inputCls} /></Field>
          <Field label="Ends" optional><input name="endsAt" type="date" className={inputCls} /></Field>
          <Field label="Show again after (hours)"><input name="everyHours" type="number" min={1} defaultValue={24} className={inputCls} /></Field>
          <Field label="Button link" optional><input name="ctaUrl" className={inputCls} placeholder="/billing or https://…" /></Field>
          <Field label="Image URL" optional><input name="imageUrl" className={inputCls + " sm:col-span-4"} placeholder="https://… (wide, under 300 KB)" /></Field>
        </div>
      )}
    </div>
  );
}
