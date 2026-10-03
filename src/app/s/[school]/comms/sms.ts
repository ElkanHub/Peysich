/** SMS arithmetic shared by the blast form (client) and the page (server). */

export { SMS_COST_PESEWAS } from "@/lib/sms-cost";

/** Segments a text takes — the same arithmetic notify() charges by. */
export { smsParts as smsSegments } from "@/messaging/sms-parts";

/** What the parent's phone actually receives: the text plus the school's signature. */
export const withSignature = (body: string, schoolName: string) => `${body} — ${schoolName}`;
