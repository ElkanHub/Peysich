import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { schools } from "@/db/schema";
import { getConsoleGrants, requireConsoleUser } from "@/core/console";
import { STREAM_WORDS, revenueEvents } from "@/core/finance";

export const runtime = "nodejs";

const esc = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

/** Every transaction as CSV, the whole platform or one school: the report a
 *  school asks for, or the month-end file for the accountant. */
export async function GET(req: NextRequest) {
  const u = await requireConsoleUser();
  const grants = await getConsoleGrants(u.id);
  if (grants && !grants.has("financials")) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const schoolId = req.nextUrl.searchParams.get("school") ?? undefined;
  const [events, allSchools] = await Promise.all([revenueEvents(schoolId), db.select({ id: schools.id, name: schools.name, slug: schools.slug }).from(schools)]);
  const name = new Map(allSchools.map((s) => [s.id, s.name]));
  const lines = [["Date", "School", "Stream", "Detail", "Reference", "GHS"].join(",")];
  for (const e of events)
    lines.push([e.at.toISOString().slice(0, 10), name.get(e.schoolId) ?? "", STREAM_WORDS[e.stream], e.detail, e.reference, (e.pesewas / 100).toFixed(2)].map(esc).join(","));
  const slug = schoolId ? allSchools.find((s) => s.id === schoolId)?.slug ?? "school" : "all-schools";
  return new NextResponse(lines.join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="schoolspec-revenue-${slug}-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}
