import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { students } from "@/db/schema";
import { requireSchool } from "@/core/school-context";

/** Undo for the toast (lib/flash.ts `undo`): a discarded draft comes back.
 *  Nothing was deleted — discard only flipped status, so this flips it back. */
export async function POST(_: Request, { params }: { params: Promise<{ school: string; id: string }> }) {
  const { school: slug, id } = await params;
  const { school } = await requireSchool(slug, ["admin"]);
  await db.update(students).set({ status: "draft" }).where(and(
    eq(students.id, id), eq(students.schoolId, school.id), eq(students.status, "discarded")));
  return Response.json({ ok: true });
}
