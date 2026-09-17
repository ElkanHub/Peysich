import { NextRequest, NextResponse } from "next/server";
import { saveRegister } from "@/app/s/[school]/attendance/actions";

/** Replays a register that was marked offline. Same action, same rights
 *  checks, same absence SMS — the queue only changes WHEN it reaches us. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as
    { slug?: string; classId?: string; date?: string; statuses?: Record<string, string> } | null;
  if (!body?.slug || !body.classId || !body.statuses)
    return NextResponse.json({ error: "Incomplete register." }, { status: 400 });
  const f = new FormData();
  if (body.date) f.set("date", body.date);
  for (const [id, s] of Object.entries(body.statuses)) f.set(`st_${id}`, s);
  try {
    const r = await saveRegister(body.slug, body.classId, f);
    if (r && "err" in r) return NextResponse.json({ error: r.err }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save";
    // rights/setup problems are final; anything else may be transient
    const final = /teacher|term|Forbidden|not found/i.test(msg);
    return NextResponse.json({ error: msg }, { status: final ? 403 : 500 });
  }
}
