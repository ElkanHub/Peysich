"use client";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { createStudent } from "../../actions";
import { Card, Field, PageHeader, inputCls, btnCls } from "@/ui/kit";

export function StudentForm({ slug, classes }: { slug: string; classes: { id: string; name: string }[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    async (prev: unknown, f: FormData) => {
      const r = await createStudent(slug, prev, f);
      if (r && "ok" in r) { router.push("/students"); return null; }
      return r;
    }, null);

  return (
    <div className="max-w-lg">
      <PageHeader title="Add student" />
      <Card>
        {state?.error && <p className="mb-3 text-sm text-danger">{state.error}</p>}
        <form action={action} className="grid grid-cols-2 gap-3">
          <Field label="First name"><input name="firstName" required className={inputCls} /></Field>
          <Field label="Last name"><input name="lastName" required className={inputCls} /></Field>
          <Field label="Sex">
            <select name="sex" className={inputCls}><option value="male">Male</option><option value="female">Female</option></select>
          </Field>
          <Field label="Class">
            <select name="classId" required className={inputCls}>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Date of birth"><input name="dob" type="date" className={inputCls} /></Field>
          <Field label="Admission no (auto if blank)"><input name="admissionNo" className={inputCls} /></Field>
          <Field label="Guardian name"><input name="guardianName" className={inputCls} /></Field>
          <Field label="Guardian phone"><input name="guardianPhone" className={inputCls} /></Field>
          <button disabled={pending} className={btnCls + " col-span-2"}>
            {pending ? "Saving…" : "Save student"}
          </button>
        </form>
      </Card>
    </div>
  );
}
