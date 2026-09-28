import crypto from "crypto";
import { headers } from "next/headers";

/** Paystack behind our own interface (doc 09 #3). No key → FAKE MODE:
 *  checkout "succeeds" instantly via /api/pay/fake so the whole flow works
 *  locally and in demos without a Paystack account. Never in production —
 *  there a missing key means "online payment is switched off", not "free". */
const KEY = process.env.PAYSTACK_SECRET_KEY;
export const fakeMode = !KEY && process.env.NODE_ENV !== "production";
/** Pages hide the Pay button when this is false and say so in words. */
export const onlinePayEnabled = !!KEY || fakeMode;
export const ONLINE_PAY_OFF = "Online payment is not switched on for this school yet. Pay at the office or by the ways listed below.";

/** Paystack wants an absolute callback_url; callers pass app paths. */
async function absolute(url: string) {
  if (!url.startsWith("/")) return url;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}${url}`;
}

export async function initCheckout(opts: {
  email: string; amountPesewas: number; reference: string; callbackUrl: string;
  metadata?: Record<string, string>;
}): Promise<{ checkoutUrl: string }> {
  if (!onlinePayEnabled) throw new Error(ONLINE_PAY_OFF);
  if (fakeMode) {
    return { checkoutUrl: `/api/pay/fake?ref=${opts.reference}&cb=${encodeURIComponent(opts.callbackUrl)}` };
  }
  const callback_url = await absolute(opts.callbackUrl);
  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: opts.email, amount: opts.amountPesewas, currency: "GHS",
      reference: opts.reference, callback_url, metadata: opts.metadata,
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
