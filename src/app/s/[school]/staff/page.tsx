import { eq, isNull, and } from "drizzle-orm";
import { db } from "@/db";
import { staff } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { createStaff } from "../actions";
import { Card, DataTable, Field, PageHeader, Tr, Td, btnCls, inputCls } from "@/ui/kit";

export default async function Staff({ params }: { params: Promise<{ school: string }> }) {
  const { school: slug } = await params;
  const { school } = await requireSchool(slug, ["admin"]);
  const rows = await db.select().from(staff)
    .where(and(eq(staff.schoolId, school.id), isNull(staff.deletedAt))).orderBy(staff.name);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Staff" sub={`${rows.length} staff members`} />
      <DataTable head={["Name", "Role", "Email", "Phone"]}>
        {rows.map((s) => (
          <Tr key={s.id}>
            <Td className="font-medium">{s.name}</Td>
            <Td className="capitalize">{s.staffRole}</Td>
            <Td>{s.email ?? "—"}</Td><Td>{s.phone ?? "—"}</Td>
          </Tr>
        ))}
      </DataTable>
      <Card className="mt-5">
        <h2 className="font-semibold">Add staff member</h2>
        <form action={createStaff.bind(null, slug)} className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Full name"><input name="name" required className={inputCls} /></Field>
          <Field label="Role">
            <select name="staffRole" className={inputCls}>
              <option value="teacher">Teacher</option>
              <option value="admin">Admin</option>
              <option value="bursar">Bursar</option>
            </select>
          </Field>
          <Field label="Email (for account invite)"><input name="email" type="email" className={inputCls} /></Field>
          <Field label="Phone"><input name="phone" className={inputCls} /></Field>
          <button className={btnCls + " col-span-2"}>Add staff</button>
        </form>
      </Card>
    </div>
  );
}
