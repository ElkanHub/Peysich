"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { leaveRequests } from "@/db/schema";
import { requireModule } from "@/core/school-context";
import { uid } from "@/lib/utils";

export async function addLeave(slug: string, f: FormData) {
  const { school } = await requireModule(slug, "hr", ["admin"]);
  await db.insert(leaveRequests).values({
    id: uid(), schoolId: school.id, staffId: String(f.get("staffId")),
    fromDate: String(f.get("fromDate")), toDate: String(f.get("toDate")),
    reason: String(f.get("reason") || "") || null,
  });
  revalidatePath(`/hr`);
  redirect(`/hr?flash=saved`);
}

export async function setLeaveStatus(slug: string, id: string, status: string) {
  const { school } = await requireModule(slug, "hr", ["admin"]);
  await db.update(leaveRequests).set({ status })
    .where(and(eq(leaveRequests.id, id), eq(leaveRequests.schoolId, school.id)));
  revalidatePath(`/hr`);
  redirect(`/hr?flash=saved`);
}
