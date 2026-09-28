"use client";
import { useState } from "react";
import { Field, inputCls, btnCls } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";

/** Set homework: two decisions (what, and — if not the usual — which class).
 *  Subjects follow the chosen class; the server checks the pair again. */
export function SetHomeworkForm({ action, classes, subjects, pairs, defaultClassId, defaultDue }: {
  action: (f: FormData) => Promise<void>;
  classes: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
  /** class × subject this teacher may set for */
  pairs: { classId: string; subjectId: string }[];
  defaultClassId: string;
  defaultDue: string;
}) {
  const [classId, setClassId] = useState(defaultClassId);
  const subs = subjects.filter((s) => pairs.some((p) => p.classId === classId && p.subjectId === s.id));
  return (
    <form action={action} className="mt-3 grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <Field label="What to do"><input name="title" required className={inputCls} placeholder="e.g. Exercise 4, questions 1–10" /></Field>
      </div>
      <Field label="Class">
        <select name="classId" value={classId} onChange={(e) => setClassId(e.target.value)} className={inputCls}>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="Subject">
        <select name="subjectId" key={classId} required className={inputCls} defaultValue={subs[0]?.id ?? ""}>
          {subs.length === 0 && <option value="">No subject for this class</option>}
          {subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      <Field label="Due"><input name="dueDate" type="date" required defaultValue={defaultDue} className={inputCls} /></Field>
      <div className="col-span-2">
        <Field label="Instructions (optional)"><textarea name="instructions" rows={2} className={inputCls} /></Field>
      </div>
      <SubmitButton className={btnCls + " col-span-2"} pendingText="Giving…" disabled={subs.length === 0 || undefined}>
        Give homework
      </SubmitButton>
    </form>
  );
}
