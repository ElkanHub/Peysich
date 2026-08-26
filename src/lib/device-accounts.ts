/** Accounts remembered on THIS device, so switching (e.g. a teacher who is
 *  also a parent) is two taps instead of typing. Client-only localStorage —
 *  we keep the sign-in identifier and display name, NEVER a password. */
export type DeviceAccount = { id: string; name?: string | null; at: number };

const KEY = "peysich.accounts";

export function loadAccounts(): DeviceAccount[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(list)
      ? list.filter((a): a is DeviceAccount => Boolean(a && typeof a.id === "string" && a.id))
      : [];
  } catch { return []; }
}

export function rememberAccount(a: { id: string; name?: string | null }) {
  try {
    const rest = loadAccounts().filter((x) => x.id.toLowerCase() !== a.id.toLowerCase());
    localStorage.setItem(KEY, JSON.stringify([{ ...a, at: Date.now() }, ...rest].slice(0, 5)));
  } catch { /* storage may be blocked — remembering is a convenience only */ }
}

export function forgetAccount(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(loadAccounts().filter((x) => x.id !== id)));
  } catch { /* ignore */ }
}
