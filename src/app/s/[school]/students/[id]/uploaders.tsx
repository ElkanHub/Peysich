"use client";
import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { inputCls, btnGhostCls } from "@/ui/kit";
import { Dropzone, FileChip, UploadProgress, useR2Upload, MAX_UPLOAD_MB } from "@/ui/upload";
import { setStudentPhoto, addStudentFile } from "./actions";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const IMAGE_LABEL = "JPG, PNG or WebP";

/** Profile photo: current picture (or initials), instant local preview,
 *  real progress, explicit success/error. Photos are downscaled to ≤512px
 *  before upload so R2 stays tiny and pages load fast. */
export function PhotoUploader({ slug, studentId, enabled, currentUrl, initials }: {
  slug: string; studentId: string; enabled: boolean;
  currentUrl?: string | null; initials?: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const up = useR2Upload({
    kind: "photo", accept: IMAGE_TYPES, acceptLabel: IMAGE_LABEL, optimize: true,
    save: (key) => setStudentPhoto(slug, studentId, key),
  });

  if (!enabled)
    return (
      <p className="text-xs text-muted-foreground">
        Photo upload activates once file storage (R2) is configured — HANDOFF §4.
      </p>
    );

  const shown = up.state.phase === "error" ? currentUrl : (preview ?? currentUrl);
  return (
    <div>
      <div className="flex items-center gap-4">
        <span className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft text-lg font-semibold text-primary ring-1 ring-border">
          {shown
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={shown} alt="Profile photo" className="h-full w-full object-cover" />
            : (initials ?? <Camera size={22} className="text-primary/60" />)}
          {up.busy && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-[12px] font-semibold text-white">
              {up.state.phase === "uploading" ? `${up.state.pct}%` : "…"}
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <button type="button" disabled={up.busy} onClick={() => inputRef.current?.click()}
            className={btnGhostCls + " disabled:opacity-50"}>
            {currentUrl || preview ? "Replace photo" : "Upload photo"}
          </button>
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">
            {IMAGE_LABEL} · up to {MAX_UPLOAD_MB} MB · auto-resized to passport size
          </p>
          <input ref={inputRef} type="file" accept={IMAGE_TYPES.join(",")} className="hidden"
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

const DOC_KINDS = [
  ["birth_certificate", "Birth certificate"],
  ["immunization", "Immunization / weighing card"],
  ["previous_report", "Previous school report"],
  ["id_document", "ID document"],
  ["other", "Other"],
] as const;
const DOC_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const DOC_LABEL = "PDF, JPG, PNG or WebP";

/** Document upload: drag-and-drop or browse, file chip with name/type/size,
 *  progress bar, and a clean reset for the next document. */
export function DocumentUploader({ slug, studentId }: { slug: string; studentId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const up = useR2Upload({
    kind: "document", accept: DOC_TYPES, acceptLabel: DOC_LABEL,
    save: async (key) => {
      const f = new FormData(formRef.current!);
      const title = String(f.get("title") ?? "").trim() || file!.name.replace(/\.\w+$/, "");
      const r = await addStudentFile(slug, studentId, {
        kind: String(f.get("kind") || "other"), title,
        fileKey: key, note: String(f.get("note") ?? "").trim() || undefined,
      });
      if (r && "ok" in r) { formRef.current?.reset(); setFile(null); }
      return r;
    },
  });

  return (
    <form ref={formRef} className="grid grid-cols-2 gap-3"
      onSubmit={(e) => { e.preventDefault(); if (file) up.run(file); }}>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Document type</label>
        <select name="kind" className={inputCls} disabled={up.busy}>
          {DOC_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Title</label>
        <input name="title" placeholder="Birth certificate — scanned copy" className={inputCls} disabled={up.busy} />
      </div>
      <div className="col-span-2">
        {file
          ? <FileChip file={file} disabled={up.busy} onClear={() => { setFile(null); up.reset(); }} />
          : <Dropzone accept={DOC_TYPES.join(",")} acceptLabel={DOC_LABEL} compact
              onFile={(f) => { setFile(f); up.reset(); }} />}
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Note (optional)</label>
        <input name="note" placeholder="Original kept by parent" className={inputCls} disabled={up.busy} />
      </div>
      <div className="flex items-end">
        <button disabled={up.busy || !file} className={btnGhostCls + " w-full disabled:opacity-50"}>
          {up.busy ? "Uploading…" : "Upload document"}
        </button>
      </div>
      <div className="col-span-2">
        <UploadProgress state={up.state} onRetry={up.retry} />
      </div>
    </form>
  );
}
