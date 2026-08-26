"use client";
import { LogOut, ArrowLeftRight } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { rememberAccount } from "@/lib/device-accounts";

/** Remember who this was (identifier + name only) so the sign-in page can
 *  offer them back as a one-tap account. */
async function stashCurrentAccount() {
  try {
    const s = await authClient.getSession();
    const u = s.data?.user as { email?: string; name?: string; username?: string | null } | undefined;
    const id = u?.username || u?.email;
    if (id) rememberAccount({ id, name: u?.name });
  } catch { /* purely a convenience */ }
}

export function SignOutButton() {
  return (
    <button
      onClick={async () => {
        await stashCurrentAccount();
        await authClient.signOut();
        window.location.href = "/sign-in";
      }}
      className="flex items-center gap-1.5 text-[12px] font-medium text-ink-text/60 transition-colors hover:text-ink-text-strong">
      <LogOut size={12} /> Sign out
    </button>
  );
}

/** For the person who is two people — a teacher who is also a parent, an
 *  admin with a cashier login. Signs out and lands on the account picker. */
export function SwitchAccountButton() {
  return (
    <button
      onClick={async () => {
        await stashCurrentAccount();
        await authClient.signOut();
        window.location.href = "/sign-in?switch=1";
      }}
      className="flex items-center gap-1.5 text-[12px] font-medium text-ink-text/60 transition-colors hover:text-ink-text-strong">
      <ArrowLeftRight size={12} /> Switch
    </button>
  );
}
