import { NextRequest, NextResponse } from "next/server";
import { dunningSweep } from "@/core/billing";

/** Daily Vercel Cron (vercel.json): trials expire, overdue → past_due → suspended. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await dunningSweep();
  return NextResponse.json({ ok: true });
}
