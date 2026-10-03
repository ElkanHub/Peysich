import { TEMPLATES, type MessageKind } from "./templates";

export type Vars = Record<string, string | number | null | undefined>;

const SLOT = /\{\{(\w+)\}\}/g;

/** Fill a text's `{{slots}}`; a missing var renders as nothing. */
export const fill = (text: string, vars: Vars) =>
  text.replace(SLOT, (_, k: string) => vars[k] == null ? "" : String(vars[k]));

/** The SMS sentence for a kind. */
export function render(kind: MessageKind, vars: Vars): string {
  return fill(TEMPLATES[kind].sms, vars);
}

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
/** The one-tap link to a message (src/app/n/[token]). */
export const linkUrl = (token: string) => `${ROOT.startsWith("localhost") ? "http" : "https"}://${ROOT}/n/${token}`;

/** A page inside a school, as a full address — for the link in a ping. */
export const schoolUrl = (slug: string, path: string) =>
  ROOT.startsWith("localhost") || ROOT.endsWith("vercel.app") ? `https://${ROOT}${path}` : `https://${slug}.${ROOT}${path}`;

/** The ping's title when the school typed only a text: its first line, cut to fit one SMS. */
export const titleOf = (body: string) => {
  const line = body.trim().split("\n")[0];
  return line.length > 60 ? `${line.slice(0, 57).trimEnd()}…` : line;
};

/** Meta's positional parameters for a template text: our named slots in order
 *  of first appearance. Null when any is empty — Meta rejects a blank
 *  parameter, so the caller falls back to SMS. */
export function waParams(text: string, vars: Vars): string[] | null {
  const names = [...new Set([...text.matchAll(SLOT)].map((m) => m[1]))];
  const out = names.map((n) => String(vars[n] ?? "").replace(/\s+/g, " ").trim());
  return out.every(Boolean) ? out : null;
}
