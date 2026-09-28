"use client";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { btnCls, btnGhostCls, btnDangerCls } from "@/ui/kit";

/** A submit button that asks first. Used ONLY where money leaves, a message
 *  goes out, or something locks (see docs/SIMPLICITY_AUDIT.md §4) —
 *  everything else gets an Undo toast instead of a question.
 *
 *  Drop it inside a <form action={serverAction}> in place of the submit
 *  button. The question carries the real numbers, computed on the server
 *  and passed in as text:
 *
 *    <ConfirmButton title="Create Term 1 bills?"
 *      body="312 children, totalling GHS 46,800. Each parent gets an SMS."
 *      confirmLabel="Create bills">Create bills</ConfirmButton>
 */
export function ConfirmButton({
  title, body, confirmLabel, cancelLabel = "Not now", danger, disabled, className, children,
}: {
  title: string; body?: React.ReactNode; confirmLabel: string; cancelLabel?: string;
  danger?: boolean; disabled?: boolean; className?: string; children: React.ReactNode;
}) {
  const dlg = useRef<HTMLDialogElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={btn} type="button" disabled={disabled} className={cn(className ?? btnCls)}
        onClick={() => dlg.current?.showModal()}>
        {children}
      </button>
      <dialog ref={dlg}
        className="w-[calc(100%-32px)] max-w-[440px] rounded-2xl border border-border bg-card p-0 text-foreground shadow-[var(--shadow-lg)] backdrop:bg-black/50"
        onClick={(e) => { if (e.target === dlg.current) dlg.current?.close(); }}>
        <div className="p-6">
          <h2 className="text-[19px] font-bold leading-snug">{title}</h2>
          {body && <div className="mt-3 text-[15.5px] leading-relaxed text-muted-foreground">{body}</div>}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className={cn(btnGhostCls, "h-11 text-[15px]")} onClick={() => dlg.current?.close()}>
              {cancelLabel}
            </button>
            <button type="button" className={cn(danger ? btnDangerCls : btnCls, "h-11 text-[15px]")}
              onClick={() => { dlg.current?.close(); btn.current?.form?.requestSubmit(); }}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
