import crypto from "crypto";

/** Meta WhatsApp Cloud API (docs/MESSAGING_SETUP.md §5). Business-initiated
 *  messages are approved templates only; free text is allowed only as a reply
 *  inside the 24-hour window after the person wrote to us. */
const GRAPH = "https://graph.facebook.com/v21.0";
const auth = () => ({ Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" });

export const whatsappConfigured = () => !!process.env.WHATSAPP_TOKEN;

/** Ghana numbers as Meta wants them: digits only, country code first. */
export function waNumber(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d.startsWith("0") && d.length === 10 ? `233${d.slice(1)}` : d;
}

async function post(phoneNumberId: string, payload: object): Promise<{ providerId?: string }> {
  const res = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
    method: "POST", headers: auth(), body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
  });
  const j = await res.json().catch(() => null) as { messages?: { id: string }[]; error?: { message?: string } } | null;
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${j?.error?.message ?? ""}`.trim());
  return { providerId: j?.messages?.[0]?.id };
}

export const sendWhatsAppTemplate = (o: { phoneNumberId: string; to: string; template: string; params: string[] }) =>
  post(o.phoneNumberId, {
    to: waNumber(o.to), type: "template",
    template: {
      name: o.template, language: { code: "en" },
      components: o.params.length ? [{ type: "body", parameters: o.params.map((text) => ({ type: "text", text })) }] : [],
    },
  });

export const sendWhatsAppText = (o: { phoneNumberId: string; to: string; text: string }) =>
  post(o.phoneNumberId, { to: waNumber(o.to), type: "text", text: { body: o.text } });

/** Every template on the business account with Meta's verdict. */
export async function fetchWhatsAppTemplates(): Promise<{ name: string; status: string; category: string }[]> {
  const waba = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  if (!whatsappConfigured() || !waba) return [];
  const res = await fetch(`${GRAPH}/${waba}/message_templates?fields=name,status,category&limit=200`, { headers: auth() });
  if (!res.ok) throw new Error(`WhatsApp templates ${res.status}`);
  return ((await res.json()) as { data?: { name: string; status: string; category: string }[] }).data ?? [];
}

/** GREEN | YELLOW | RED, or null when it cannot be read. */
export async function fetchWhatsAppQuality(phoneNumberId: string): Promise<string | null> {
  if (!whatsappConfigured() || !phoneNumberId) return null;
  try {
    const res = await fetch(`${GRAPH}/${phoneNumberId}?fields=quality_rating`, { headers: auth() });
    return ((await res.json()) as { quality_rating?: string }).quality_rating ?? null;
  } catch { return null; }
}

/** Meta signs every webhook body with the app secret (WHATSAPP_APP_SECRET).
 *  Without the secret nothing can be verified, so in production nothing is
 *  trusted; local development lets it through. */
export function validWhatsAppSignature(body: string, signature: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  if (!signature) return false;
  const want = "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
  return want.length === signature.length && crypto.timingSafeEqual(Buffer.from(want), Buffer.from(signature));
}
