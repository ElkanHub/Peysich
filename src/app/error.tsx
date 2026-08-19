"use client";
import { AlertTriangle } from "lucide-react";
import { btnCls, btnGhostCls } from "@/ui/kit";

/** Friendly failure screen — the user NEVER sees stack traces or codes.
 *  Server-action errors land here too, so a failed save is loud, not silent. */
export default function RootError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-danger/10">
        <AlertTriangle size={22} className="text-danger" />
      </span>
      <h1 className="mt-4 text-lg font-semibold">That didn’t go through</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Something went wrong on our side and nothing was saved.
        Try again — if it keeps happening, contact support and we&apos;ll sort it out.
      </p>
      <div className="mt-5 flex justify-center gap-2">
        <button onClick={() => reset()} className={btnCls}>Try again</button>
        <a href="/" className={btnGhostCls}>Go to dashboard</a>
      </div>
    </div>
  );
}
