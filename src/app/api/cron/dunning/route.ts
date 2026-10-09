import { NextRequest, NextResponse } from "next/server";
import { dunningSweep } from "@/core/billing";
import { platformSweep } from "@/messaging/platform";
import { termSweep } from "@/core/terms";

/** Daily Vercel Cron (vercel.json): trials expire, overdue → past_due → suspended;
 *  then the platform calendar — stages, the messages due today, the 7:00 digest. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await dunningSweep();
  await platformSweep();
  await termSweep();
  return NextResponse.json({ ok: true });
}
