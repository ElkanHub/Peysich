import { NextRequest, NextResponse } from "next/server";
import { checkFailureRate, drainOutbox } from "@/messaging/outbox";

/** The minute worker, called by an outside scheduler (cron-job.org) with
 *  `Authorization: Bearer CRON_SECRET` — not in vercel.json, so the Hobby plan
 *  deploys. Sends what is queued, retries what failed,
 *  refunds what failed for good, and rings the operator when a provider is down. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const r = await drainOutbox();
  await checkFailureRate();
  return NextResponse.json({ ok: true, ...r });
}
