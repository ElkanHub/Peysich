"use client";
import { useRef, useState } from "react";
import { PenLine, Stamp } from "lucide-react";
import { btnGhostCls } from "@/ui/kit";
import { UploadProgress, useR2Upload, MAX_UPLOAD_MB } from "@/ui/upload";
import { saveDocImage, type DocImageSlot } from "./docsign-actions";

const TYPES = ["image/png", "image/jpeg", "image/webp"];
const LABEL = "PNG, JPG or WebP";

/** One signature / stamp slot: preview, upload with progress, replace.
 *  A transparent PNG sits best on printed papers — the hint says so. */
export function DocImageUploader({ slug, slot, label, hint, enabled, currentUrl, stamp }: {
  slug: string; slot: DocImageSlot; label: string; hint: string;
  enabled: boolean; currentUrl?: string | null; stamp?: boolean;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const up = useR2Upload({
    kind: "sign", accept: TYPES, acceptLabel: LABEL, optimize: false,
    save: (key) => saveDocImage(slug, slot, key),
  });
  if (!enabled)
    return <p className="text-xs text-muted-foreground">{label}: uploads activate once file storage (R2) is configured.</p>;

  const shown = up.state.phase === "error" ? currentUrl : (preview ?? currentUrl);
  const Icon = stamp ? Stamp : PenLine;
  return (
    <div data-docsign={slot}>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex items-center gap-4">
        <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white ${stamp ? "h-16 w-16" : "h-14 w-28"}`}>
          {shown
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={shown} alt={label} className="h-full w-full object-contain" />
            : <Icon size={18} className="text-muted-foreground" />}
        </span>
        <div>
          <button type="button" disabled={up.busy} onClick={() => inputRef.current?.click()}
            className={btnGhostCls + " disabled:opacity-50"}>
            {shown ? "Replace" : "Upload"}
          </button>
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">
            {hint} · {LABEL}, up to {MAX_UPLOAD_MB} MB
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
