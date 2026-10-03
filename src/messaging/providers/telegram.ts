import crypto from "crypto";

/** Telegram Bot API (docs/MESSAGING_SETUP.md §3). Two bots: the school bot
 *  parents and staff link to, and the ops bot that alerts the operator. */
export type Bot = "school" | "ops";
const token = (bot: Bot) => bot === "ops" ? process.env.TELEGRAM_OPS_TOKEN : process.env.TELEGRAM_BOT_TOKEN;
export const telegramConfigured = (bot: Bot = "school") => !!token(bot);

async function call<T>(bot: Bot, method: string, payload: object): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${token(bot)}/${method}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  const j = await res.json().catch(() => null) as { ok?: boolean; result?: T; description?: string } | null;
  if (!j?.ok) throw new Error(`Telegram ${res.status}: ${j?.description ?? ""}`.trim());
  return j.result as T;
}

export async function sendTelegram(o: { bot?: Bot; chatId: string; text: string }): Promise<{ providerId?: string }> {
  const r = await call<{ message_id: number }>(o.bot ?? "school", "sendMessage", {
    chat_id: o.chatId, text: o.text, link_preview_options: { is_disabled: true },
  });
  return { providerId: String(r.message_id) };
}

const sign = (s: string) =>
  crypto.createHmac("sha256", process.env.MESSAGING_LINK_SECRET ?? process.env.BETTER_AUTH_SECRET ?? "dev").update(s).digest("base64url");

/** The secret Telegram echoes on every webhook call, so nobody else can post to it. */
export const webhookSecret = (bot: Bot) => sign(`telegram-webhook:${bot}`).slice(0, 32);

/** Point a bot's webhook at this deployment. Run from the console once. */
export const setTelegramWebhook = (bot: Bot, origin: string) =>
  call<boolean>(bot, "setWebhook", {
    url: `${origin}/api/webhooks/telegram?bot=${bot}`, secret_token: webhookSecret(bot), allowed_updates: ["message"],
  });

let username: Promise<string | null> | undefined;
/** The school bot's @username, for t.me links. Asked once per server instance. */
export function botUsername(): Promise<string | null> {
  if (!telegramConfigured()) return Promise.resolve(null);
  return username ??= call<{ username: string }>("school", "getMe", {}).then((r) => r.username).catch(() => null);
}

/** The `/start` payload that links a Telegram chat to a guardian or staff
 *  record: `g<id>_<sig>` — signed, so a chat can only link to a record whose
 *  link the school or the person themself opened. Fits Telegram's 64
 *  characters of [A-Za-z0-9_-] once the dashes are dropped from the id. */
export function linkPayload(kind: "guardian" | "staff", id: string) {
  const body = `${kind[0]}${id.replace(/-/g, "")}`;
  return `${body}_${sign(body).replace(/[-_]/g, "").slice(0, 16)}`;
}
export function readLinkPayload(payload: string): { kind: "guardian" | "staff"; idNoDashes: string } | null {
  const [body, sig] = payload.split("_");
  if (!body || !sig || sign(body).replace(/[-_]/g, "").slice(0, 16) !== sig) return null;
  const kind = body[0] === "g" ? "guardian" : body[0] === "s" ? "staff" : null;
  return kind ? { kind, idNoDashes: body.slice(1) } : null;
}
export async function telegramLink(kind: "guardian" | "staff", id: string) {
  const u = await botUsername();
  return u ? `https://t.me/${u}?start=${linkPayload(kind, id)}` : null;
}
