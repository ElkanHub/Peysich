import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { staff } from "@/db/schema";
import { requireSchool } from "@/core/school-context";

/** Undo for the toast (lib/flash.ts `undo`). Both removals on a staff record
 *  are status flips, never deletes, so undo is the reverse flip:
 *  discarded draft → draft again; marked as left → active again. */
export async function POST(_: Request, { params }: { params: Promise<{ school: string; id: string }> }) {
  const { school: slug, id } = await params;
  const { school } = await requireSchool(slug, ["admin"]);
  const [s] = await db.select({ status: staff.status }).from(staff)
    .where(and(eq(staff.id, id), eq(staff.schoolId, school.id)));
  if (s?.status === "discarded")
    await db.update(staff).set({ status: "draft" }).where(eq(staff.id, id));
  if (s?.status === "left")
    await db.update(staff).set({ status: "active", exitDate: null, exitNote: null }).where(eq(staff.id, id));
  return Response.json({ ok: true });
}
