"use client";
import { useRef, useState } from "react";
import { ImageIcon } from "lucide-react";
import { btnGhostCls } from "@/ui/kit";
import { UploadProgress, useR2Upload, MAX_UPLOAD_MB } from "@/ui/upload";
import { saveLogo } from "../actions-grading";

const TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const LABEL = "PNG, JPG, WebP or SVG";

/** School logo: current logo preview, progress, explicit success/error.
 *  Lands on report cards, invoices, receipts, emails and the app header. */
export function LogoUploader({ slug, enabled, currentUrl }: {
  slug: string; enabled: boolean; currentUrl?: string | null;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const up = useR2Upload({
    kind: "logo", accept: TYPES, acceptLabel: LABEL, optimize: false,
    save: (key) => saveLogo(slug, key),
  });
  if (!enabled)
    return <p className="text-xs text-muted-foreground">Logo upload activates once file storage (R2) is configured — HANDOFF §4.</p>;

  const shown = up.state.phase === "error" ? currentUrl : (preview ?? currentUrl);
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">School logo</label>
      <div className="flex items-center gap-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/40">
          {shown
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={shown} alt="School logo" className="h-full w-full object-contain" />
            : <ImageIcon size={20} className="text-muted-foreground" />}
        </span>
        <div>
          <button type="button" disabled={up.busy} onClick={() => inputRef.current?.click()}
            className={btnGhostCls + " disabled:opacity-50"}>
            {shown ? "Replace logo" : "Upload logo"}
          </button>
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">
            {LABEL} · up to {MAX_UPLOAD_MB} MB · square works best on printouts
          </p>
          <input ref={inputRef} type="file" accept={TYPES.join(",")} className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.type.startsWith("image/")) setPreview(URL.createObjectURL(f));
              up.run(f);
              e.target.value = "";
            }} />
        </div>
      </div>
      <UploadProgress state={up.state} onRetry={up.retry} />
    </div>
  );
}
