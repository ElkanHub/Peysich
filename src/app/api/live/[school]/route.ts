import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { schools, schoolPulse } from "@/db/schema";

export const dynamic = "force-dynamic";

/** Tiny polling target for live updates: returns the school's pulse version,
 *  bumped by DB triggers on every data write. Exposes nothing but a counter. */
export async function GET(_req: Request, ctx: { params: Promise<{ school: string }> }) {
  const { school } = await ctx.params;
  const [row] = await db
    .select({ v: schoolPulse.version })
    .from(schools)
    .leftJoin(schoolPulse, eq(schoolPulse.schoolId, schools.id))
    .where(eq(schools.slug, school));
  return NextResponse.json(
    { v: row?.v ?? 0 },
    { headers: { "cache-control": "no-store" } },
  );
}
