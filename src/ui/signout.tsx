"use client";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  return (
    <button
      onClick={() => authClient.signOut().then(() => (window.location.href = "/sign-in"))}
      className="mt-1 text-xs text-muted-foreground underline-offset-2 hover:underline">
      Sign out
    </button>
  );
}
