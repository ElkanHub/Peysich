"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { assignments } from "@/db/schema";
import { requireModule } from "@/core/school-context";
import { uid } from "@/lib/utils";

export async function createHomework(slug: string, f: FormData) {
  const { school, user } = await requireModule(slug, "homework", ["admin", "teacher"]);
  await db.insert(assignments).values({
    id: uid(), schoolId: school.id,
    classId: String(f.get("classId")), subjectId: String(f.get("subjectId")),
    title: String(f.get("title")), instructions: String(f.get("instructions") || "") || null,
    dueDate: String(f.get("dueDate")), createdBy: user.id,
  });
  revalidatePath(`/homework`);
  redirect(`/homework?flash=saved`);
}
