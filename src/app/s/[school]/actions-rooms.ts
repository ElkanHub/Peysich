"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { rooms, classes } from "@/db/schema";
import { requireSchool } from "@/core/school-context";
import { uid } from "@/lib/utils";

export async function addRoom(slug: string, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  const name = String(f.get("name") ?? "").trim();
  if (!name) return;
  await db.insert(rooms).values({
    id: uid(), schoolId: school.id, name,
    kind: String(f.get("kind") || "classroom"),
    capacity: Number(f.get("capacity")) || null,
    notes: String(f.get("notes") ?? "").trim() || null,
  });
  revalidatePath("/settings");
}

export async function deleteRoom(slug: string, roomId: string) {
  const { school } = await requireSchool(slug, ["admin"]);
  await db.update(classes).set({ roomId: null })
    .where(and(eq(classes.schoolId, school.id), eq(classes.roomId, roomId)));
  await db.delete(rooms).where(and(eq(rooms.id, roomId), eq(rooms.schoolId, school.id)));
  revalidatePath("/settings");
}

export async function setClassRoom(slug: string, classId: string, f: FormData) {
  const { school } = await requireSchool(slug, ["admin"]);
  await db.update(classes).set({ roomId: String(f.get("roomId") || "") || null })
    .where(and(eq(classes.id, classId), eq(classes.schoolId, school.id)));
  revalidatePath("/settings");
}
