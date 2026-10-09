import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import * as XLSX from "xlsx";
import { db } from "@/db";
import { schools, terms, academicYears } from "@/db/schema";
import { getSession } from "@/core/session";
import { getTermArchive } from "@/core/term-archive";

export const runtime = "nodejs";
export const maxDuration = 60;

/** One closed term as one workbook: a sheet per section of the snapshot,
 *  the columns as Archives shows them. Admins only. */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const user = session.user as { role: string; schoolId?: string | null };
  if (user.role !== "admin" || !user.schoolId) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const termId = req.nextUrl.searchParams.get("t") ?? "";
  const [t] = await db.select({ name: terms.name, closedAt: terms.closedAt, year: academicYears.name, slug: schools.slug })
    .from(terms).innerJoin(academicYears, eq(terms.yearId, academicYears.id)).innerJoin(schools, eq(schools.id, terms.schoolId))
    .where(and(eq(terms.id, termId), eq(terms.schoolId, user.schoolId)));
  if (!t || !t.closedAt) return NextResponse.json({ error: "Only a closed term can be exported" }, { status: 404 });

  const sections = await getTermArchive(user.schoolId, termId);
  const wb = XLSX.utils.book_new();
  for (const s of sections) {
    const rows = (s.rows as Record<string, unknown>[]).map((r) => Object.fromEntries(s.columns.map(([k, l]) => [l, r[k] ?? ""])));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ "": "nothing recorded" }]), s.title.replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
  }
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const name = `${t.slug}-${t.year.replace("/", "-")}-${t.name.replace(/\s+/g, "")}.xlsx`;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}
