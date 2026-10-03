/** Routing and pricing check for the one door — run: pnpm run check:messaging
 *  Pure functions only: nothing is sent and the database is never touched. */
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://check:check@localhost:5432/check"; // never connected to
const { route } = await import("./notify");
const { waParams, titleOf } = await import("./render");
const { smsParts } = await import("./sms-parts");
const { readLinkPayload, linkPayload } = await import("./providers/telegram");

const school = { id: "s1", name: "St. Mary's", branding: { smsSenderId: "StMarys" } };
const env = { whatsapp: true, telegram: true, approved: new Set(["absence_alert", "emergency_illness", "announcement_ping"]), smsPrice: 6, whatsappPrice: 8 };
const none = { phone: null, userId: null, phoneOnly: false, whatsapp: null, telegram: null, hasPush: false };
const channels = (p: { channel: string }[]) => p.map((x) => x.channel).join(",");

// SMS arithmetic: 160 in one part, 153 after; one non-GSM character makes it 70/67
assert.equal(smsParts("a".repeat(160)), 1);
assert.equal(smsParts("a".repeat(161)), 2);
assert.equal(smsParts("a".repeat(70) + "—"), 2);

// a bare phone: one SMS at the SMS price, signed with the school's sender name
const absence = { school, kind: "absence" as const, vars: { child: "Ama", office: "0302000000" } };
let p = route(absence, { ...none, phone: "0241234567" }, env);
assert.equal(channels(p), "sms");
assert.equal(p[0].price, 6);
assert.equal(p[0].meta.senderId, "StMarys");

// number + consent + approved template: WhatsApp instead of SMS, with the SMS kept as the fallback
p = route(absence, { ...none, phone: "0241234567", whatsapp: "233241234567" }, env);
assert.equal(channels(p), "whatsapp");
assert.equal(p[0].price, 8);
assert.deepEqual(p[0].meta.params, ["St. Mary's", "Ama", "0302000000"]);
assert.equal(p[0].meta.smsFallback?.to, "0241234567");

// a template Meta has not approved, or a missing variable: SMS
assert.equal(channels(route(absence, { ...none, phone: "024", whatsapp: "233" }, { ...env, approved: new Set() })), "sms");
assert.equal(channels(route({ ...absence, vars: { child: "Ama" } }, { ...none, phone: "024", whatsapp: "233" }, env)), "sms");

// the app and Telegram always, free, before the paid ping
p = route(absence, { phone: "024", userId: "u1", hasPush: true, telegram: "99", whatsapp: null, phoneOnly: false }, env);
assert.equal(channels(p), "push,telegram,sms");
assert.equal(p[0].price + p[1].price, 0);

// emergencies: WhatsApp and SMS both
p = route({ school, kind: "emergency_illness", vars: { child: "Ama", phone: "0302", detail: "Fever" } },
  { ...none, phone: "024", whatsapp: "233" }, env);
assert.equal(channels(p), "whatsapp,sms");

// a phone-only parent gets the whole text by SMS, never the ping with a link
const ping = { school, kind: "announcement_ping" as const, vars: { title: "Closing early" }, link: "https://x/n/abc", fullText: "We close at 1pm on Friday." };
p = route(ping, { ...none, phone: "024", whatsapp: "233", phoneOnly: true }, env);
assert.equal(channels(p), "sms");
assert.equal(p[0].body, "We close at 1pm on Friday. — St. Mary's");
assert.equal(channels(route(ping, { ...none, phone: "024", whatsapp: "233" }, env)), "whatsapp");

// Meta's positional parameters: named slots in order of first appearance, none blank
assert.deepEqual(waParams("{{a}}: {{b}} ({{a}})", { a: "1", b: "2" }), ["1", "2"]);
assert.equal(waParams("{{a}} {{b}}", { a: "1" }), null);
assert.equal(titleOf("First line\nsecond"), "First line");

// the Telegram link payload: signed, round-trips, and a forged one is refused
const id = "0199a1b2-c3d4-7e5f-8a6b-0123456789ab";
const payload = linkPayload("guardian", id);
assert.ok(/^[A-Za-z0-9_-]{1,64}$/.test(payload));
assert.deepEqual(readLinkPayload(payload), { kind: "guardian", idNoDashes: id.replace(/-/g, "") });
assert.equal(readLinkPayload(payload.replace(/^g/, "s")), null);

console.log("messaging: ok (routing, prices, SMS parts, WhatsApp parameters, Telegram link)");
process.exit(0);
