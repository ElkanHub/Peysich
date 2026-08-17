import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { applicants, levels } from "@/db/schema";
import { requireModule } from "@/core/school-context";
import { addApplicant, setApplicantStatus, admitApplicant } from "./actions";
import { Card, DataTable, Field, PageHeader, Tr, Td, inputCls, btnCls } from "@/ui/kit";

export default async function Admissions({ params }: { params: Promise<{ school: string }> }) {
  const { school: slug } = await params;
  const { school } = await requireModule(slug, "admissions", ["admin"]);
  const [rows, lvs] = await Promise.all([
    db.select().from(applicants).where(eq(applicants.schoolId, school.id))
      .orderBy(desc(applicants.createdAt)).limit(50),
    db.select().from(levels).where(eq(levels.schoolId, school.id)).orderBy(levels.sortOrder),
  ]);
  const levelName = new Map(lvs.map((l) => [l.id, l.name]));

  return (
    <div className="max-w-3xl">
      <PageHeader title="Admissions" sub={`${rows.filter((r) => r.status === "new").length} new applicants`} />
      <DataTable head={["Applicant", "Level", "Guardian", "Status", "Actions"]}>
        {rows.map((a) => (
          <Tr key={a.id}>
            <Td className="font-medium">{a.name}</Td>
            <Td>{levelName.get(a.levelId)}</Td>
            <Td>{a.guardianName} · {a.guardianPhone}</Td>
            <Td className="capitalize">{a.status}</Td>
            <Td>
              {a.status !== "admitted" && a.status !== "rejected" && (
                <div className="flex gap-1">
                  <form action={admitApplicant.bind(null, slug, a.id)}>
                    <button className="rounded bg-success px-2 py-1 text-xs text-white">Admit → student</button>
                  </form>
                  <form action={setApplicantStatus.bind(null, slug, a.id, "interview")}>
                    <button className="rounded border border-border px-2 py-1 text-xs">Interview</button>
                  </form>
                  <form action={setApplicantStatus.bind(null, slug, a.id, "rejected")}>
                    <button className="rounded border border-border px-2 py-1 text-xs text-danger">Reject</button>
                  </form>
                </div>
              )}
            </Td>
          </Tr>
        ))}
      </DataTable>
      <Card className="mt-5">
        <h2 className="font-semibold">New application</h2>
        <form action={addApplicant.bind(null, slug)} className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Child's name"><input name="name" required className={inputCls} /></Field>
          <Field label="Level applying for">
            <select name="levelId" className={inputCls}>{lvs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
          </Field>
          <Field label="Guardian name"><input name="guardianName" className={inputCls} /></Field>
          <Field label="Guardian phone"><input name="guardianPhone" required className={inputCls} /></Field>
          <button className={btnCls + " col-span-2"}>Add applicant</button>
        </form>
      </Card>
    </div>
  );
}
