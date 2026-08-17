import { NextRequest, NextResponse } from "next/server";
import { validWebhookSignature } from "@/lib/paystack";
import { applySubscription, applyFeePayment } from "@/core/billing";

/** Paystack webhook: charge.success with metadata {schoolId, planKey}.
 *  Idempotent (reference-keyed); reconciliation cron re-verifies daily. */
export async function POST(req: NextRequest) {
  const body = await req.text();
  if (!validWebhookSignature(body, req.headers.get("x-paystack-signature")))
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  const evt = JSON.parse(body);
  if (evt.event === "charge.success") {
    const m = evt.data?.metadata ?? {};
    if (m.kind === "fee") await applyFeePayment(evt.data.reference);
    else if (m.schoolId && m.planKey)
      await applySubscription(m.schoolId, m.planKey, evt.data.reference);
  }
  return NextResponse.json({ ok: true });
}
