"use server";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { inventoryItems } from "@/db/schema";
import { requireModule } from "@/core/school-context";
import { uid } from "@/lib/utils";

export async function addItem(slug: string, f: FormData) {
  const { school } = await requireModule(slug, "inventory", ["admin"]);
  await db.insert(inventoryItems).values({
    id: uid(), schoolId: school.id, name: String(f.get("name")),
    location: String(f.get("location") || "") || null,
    quantity: Number(f.get("quantity")) || 0,
  });
  revalidatePath(`/inventory`);
  redirect(`/inventory?flash=saved`);
}

export async function adjustQty(slug: string, id: string, delta: number) {
  const { school } = await requireModule(slug, "inventory", ["admin"]);
  await db.update(inventoryItems)
    .set({ quantity: sql`greatest(0, quantity + ${delta})` })
    .where(and(eq(inventoryItems.id, id), eq(inventoryItems.schoolId, school.id)));
  revalidatePath(`/inventory`);
  redirect(`/inventory?flash=saved`);
}
