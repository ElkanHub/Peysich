import { eq } from "drizzle-orm";
import { db } from "@/db";
import { inventoryItems } from "@/db/schema";
import { requireModule } from "@/core/school-context";
import { addItem, adjustQty } from "./actions";
import { Card, DataTable, Field, PageHeader, Tr, Td, inputCls, btnCls } from "@/ui/kit";

export default async function Inventory({ params }: { params: Promise<{ school: string }> }) {
  const { school: slug } = await params;
  const { school } = await requireModule(slug, "inventory", ["admin"]);
  const rows = await db.select().from(inventoryItems)
    .where(eq(inventoryItems.schoolId, school.id)).orderBy(inventoryItems.name);

  return (
    <div className="max-w-2xl">
      <PageHeader title="Inventory" sub={`${rows.length} item types`} />
      <DataTable head={["Item", "Location", "Quantity", "Adjust"]}>
        {rows.map((i) => (
          <Tr key={i.id}>
            <Td className="font-medium">{i.name}</Td>
            <Td>{i.location ?? "—"}</Td>
            <Td>{i.quantity}</Td>
            <Td>
              <div className="flex gap-1">
                <form action={adjustQty.bind(null, slug, i.id, 1)}><button className="rounded border border-border px-2 py-0.5 text-xs">+1</button></form>
                <form action={adjustQty.bind(null, slug, i.id, -1)}><button className="rounded border border-border px-2 py-0.5 text-xs">−1</button></form>
              </div>
            </Td>
          </Tr>
        ))}
      </DataTable>
      <Card className="mt-5">
        <form action={addItem.bind(null, slug)} className="flex items-end gap-2">
          <Field label="Item"><input name="name" required className={inputCls} /></Field>
          <Field label="Location"><input name="location" className={inputCls} /></Field>
          <Field label="Qty"><input name="quantity" type="number" defaultValue={1} className={inputCls + " w-20"} /></Field>
          <button className={btnCls}>Add item</button>
        </form>
      </Card>
    </div>
  );
}
