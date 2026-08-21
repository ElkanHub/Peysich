"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { books, loans, students } from "@/db/schema";
import { requireModule } from "@/core/school-context";
import { uid } from "@/lib/utils";

export async function addBook(slug: string, f: FormData) {
  const { school } = await requireModule(slug, "library", ["admin", "teacher"]);
  await db.insert(books).values({
    id: uid(), schoolId: school.id, title: String(f.get("title")),
    author: String(f.get("author") || "") || null, copies: Number(f.get("copies")) || 1,
  });
  revalidatePath(`/library`);
  redirect(`/library?flash=saved`);
}

export async function loanBook(slug: string, bookId: string, f: FormData) {
  const { school } = await requireModule(slug, "library", ["admin", "teacher"]);
  const [s] = await db.select().from(students).where(and(
    eq(students.schoolId, school.id),
    eq(students.admissionNo, String(f.get("admissionNo")).trim().toUpperCase())));
  if (!s) return;
  await db.insert(loans).values({
    id: uid(), schoolId: school.id, bookId, studentId: s.id,
    loanedAt: new Date().toISOString().slice(0, 10),
  });
  revalidatePath(`/library`);
  redirect(`/library?flash=saved`);
}

export async function returnLoan(slug: string, loanId: string) {
  const { school } = await requireModule(slug, "library", ["admin", "teacher"]);
  await db.update(loans).set({ returnedAt: new Date().toISOString().slice(0, 10) })
    .where(and(eq(loans.id, loanId), eq(loans.schoolId, school.id)));
  revalidatePath(`/library`);
  redirect(`/library?flash=saved`);
}
