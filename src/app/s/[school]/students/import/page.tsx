"use client";
import { use, useActionState } from "react";
import { importStudents } from "../../actions";
import { Card, PageHeader, btnCls, inputCls } from "@/ui/kit";

export default function ImportStudents({ params }: { params: Promise<{ school: string }> }) {
  const { school: slug } = use(params);
  const [state, action, pending] = useActionState(
    (prev: unknown, f: FormData) => importStudents(slug, prev, f), null);

  return (
    <div className="max-w-2xl">
      <PageHeader title="Import students"
        sub="Columns: firstName, lastName, sex, className, guardianName, guardianPhone" />
      <Card>
        {state && "imported" in state && (
          <div className="mb-3 text-sm">
            <p className="text-success">Imported {state.imported} students.</p>
            {(state.errors ?? []).length > 0 && (
              <ul className="mt-2 list-inside list-disc text-danger">
                {(state.errors ?? []).map((e: string, i: number) => <li key={i}>{e}</li>)}
              </ul>
            )}
          </div>
        )}
        {state && "error" in state && <p className="mb-3 text-sm text-danger">{state.error}</p>}
        <form action={action}>
          <textarea name="csv" rows={12} className={inputCls + " font-mono text-xs"}
            placeholder={`firstName,lastName,sex,className,guardianName,guardianPhone\nAma,Mensah,female,Basic 4 A,Akosua Mensah,0241234567`} />
          <button disabled={pending} className={btnCls + " mt-3"}>
            {pending ? "Importing…" : "Import"}
          </button>
        </form>
      </Card>
    </div>
  );
}
