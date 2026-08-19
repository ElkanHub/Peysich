"use client";
import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { btnGhostCls } from "@/ui/kit";
import { UploadProgress, useR2Upload, MAX_UPLOAD_MB } from "@/ui/upload";
import { setStaffPhoto } from "./staff-actions";

const TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Staff passport photo — same premium pipeline as student photos. */
export function StaffPhotoUploader({ slug, staffId, enabled, currentUrl, initials }: {
  slug: string; staffId: string; enabled: boolean;
  currentUrl?: string | null; initials?: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const up = useR2Upload({
    kind: "photo", accept: TYPES, acceptLabel: "JPG, PNG or WebP", optimize: true,
    save: (key) => setStaffPhoto(slug, staffId, key),
  });
  if (!enabled)
    return <p className="text-xs text-muted-foreground">Photo upload activates once file storage (R2) is configured.</p>;
  const shown = up.state.phase === "error" ? currentUrl : (preview ?? currentUrl);
  return (
    <div>
      <div className="flex items-center gap-4">
        <span className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft text-lg font-semibold text-primary ring-1 ring-border">
          {shown
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={shown} alt="Staff photo" className="h-full w-full object-cover" />
            : (initials ?? <Camera size={20} className="text-primary/60" />)}
          {up.busy && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-[11px] font-semibold text-white">
              {up.state.phase === "uploading" ? `${up.state.pct}%` : "…"}
            </span>
          )}
        </span>
        <div>
          <button type="button" disabled={up.busy} onClick={() => inputRef.current?.click()}
            className={btnGhostCls + " disabled:opacity-50"}>
            {shown ? "Replace photo" : "Upload photo"}
          </button>
          <p className="mt-1.5 text-[11.5px] text-muted-foreground">JPG, PNG or WebP · up to {MAX_UPLOAD_MB} MB</p>
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
