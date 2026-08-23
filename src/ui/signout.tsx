"use client";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  return (
    <button
      onClick={() => authClient.signOut().then(() => (window.location.href = "/sign-in"))}
      className="flex items-center gap-1.5 text-[12px] font-medium text-ink-text/60 transition-colors hover:text-ink-text-strong">
      <LogOut size={12} /> Sign out
    </button>
  );
}
