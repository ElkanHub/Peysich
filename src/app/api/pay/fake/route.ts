import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { fakeMode } from "@/lib/paystack";
import { applySubscription, applyFeePayment } from "@/core/billing";
import { db } from "@/db";
import { pendingCheckouts } from "@/db/schema";

/** Dev/demo-only instant-success checkout. Disabled when real keys exist. */
export async function GET(req: NextRequest) {
  if (!fakeMode) return NextResponse.json({ error: "disabled" }, { status: 404 });
  const ref = req.nextUrl.searchParams.get("ref")!;
  const cb = req.nextUrl.searchParams.get("cb") ?? "/";
  if (ref.startsWith("fee_")) await applyFeePayment(ref);
  else {
    const [p] = await db.select().from(pendingCheckouts).where(eq(pendingCheckouts.reference, ref));
    if (p) await applySubscription(p.schoolId, p.planKey, ref);
  }
  return NextResponse.redirect(new URL(cb, req.url));
}
