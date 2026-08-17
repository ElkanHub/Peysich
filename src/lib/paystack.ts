import crypto from "crypto";

/** Paystack behind our own interface (doc 09 #3). No key → FAKE MODE:
 *  checkout "succeeds" instantly via /api/pay/fake so the whole flow works
 *  locally and in demos without a Paystack account. */
const KEY = process.env.PAYSTACK_SECRET_KEY;
export const fakeMode = !KEY;

export async function initCheckout(opts: {
  email: string; amountPesewas: number; reference: string; callbackUrl: string;
  metadata?: Record<string, string>;
}): Promise<{ checkoutUrl: string }> {
  if (fakeMode) {
    return { checkoutUrl: `/api/pay/fake?ref=${opts.reference}&cb=${encodeURIComponent(opts.callbackUrl)}` };
  }
  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: opts.email, amount: opts.amountPesewas, currency: "GHS",
      reference: opts.reference, callback_url: opts.callbackUrl, metadata: opts.metadata,
    }),
  });
  const j = await res.json();
  if (!j.status) throw new Error(j.message ?? "Paystack init failed");
  return { checkoutUrl: j.data.authorization_url };
}

export async function verifyTransaction(reference: string): Promise<boolean> {
  if (fakeMode) return true;
  const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${KEY}` },
  });
  const j = await res.json();
  return j.status && j.data?.status === "success";
}

export function validWebhookSignature(body: string, signature: string | null): boolean {
  if (fakeMode) return true;
  if (!signature) return false;
  return crypto.createHmac("sha512", KEY!).update(body).digest("hex") === signature;
}
