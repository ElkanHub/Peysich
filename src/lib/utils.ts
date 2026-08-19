import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** UUIDv7-ish: time-ordered unique id (sortable, import-safe). */
export function uid(): string {
  const t = Date.now().toString(16).padStart(12, "0");
  const r = crypto.getRandomValues(new Uint8Array(10));
  const hex = [...r].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${t.slice(0, 8)}-${t.slice(8)}-7${hex.slice(0, 3)}-${((r[2] & 0x3f) | 0x80).toString(16)}${hex.slice(4, 6)}-${hex.slice(6, 18)}`;
}

/** Server-safe page size for paginated lists. Lives here (not in a "use
 *  client" module) so server components importing it get the NUMBER — a
 *  client-module export becomes an inert client reference on the server,
 *  which silently disables .limit()/.offset(). */
export const PER_PAGE = 15;
