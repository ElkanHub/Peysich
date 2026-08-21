"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { routes, routeStudents, students } from "@/db/schema";
import { requireModule } from "@/core/school-context";
import { uid } from "@/lib/utils";

export async function addRoute(slug: string, f: FormData) {
  const { school } = await requireModule(slug, "transport", ["admin"]);
  await db.insert(routes).values({
    id: uid(), schoolId: school.id, name: String(f.get("name")),
    driverName: String(f.get("driverName") || "") || null,
    driverPhone: String(f.get("driverPhone") || "") || null,
  });
  revalidatePath(`/transport`);
  redirect(`/transport?flash=saved`);
}

export async function assignToRoute(slug: string, routeId: string, f: FormData) {
  const { school } = await requireModule(slug, "transport", ["admin"]);
  const [s] = await db.select().from(students).where(and(
    eq(students.schoolId, school.id),
    eq(students.admissionNo, String(f.get("admissionNo")).trim().toUpperCase())));
  if (!s) return;
  await db.insert(routeStudents).values({ routeId, studentId: s.id, schoolId: school.id });
  revalidatePath(`/transport`);
  redirect(`/transport?flash=saved`);
}
