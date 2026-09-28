/** SMS arithmetic shared by the blast form (client) and the page (server). */

export { SMS_COST_PESEWAS } from "@/lib/sms-cost";

/** Segments a text takes: 160 characters fit one SMS, 153 per SMS after that.
 *  ponytail: assumes the GSM-7 alphabet; emoji/Unicode halve the limits (70/67). */
export function smsSegments(text: string) {
  const n = text.length;
  return n <= 160 ? 1 : Math.ceil(n / 153);
}

/** What the parent's phone actually receives: the text plus the school's signature. */
export const withSignature = (body: string, schoolName: string) => `${body} — ${schoolName}`;
