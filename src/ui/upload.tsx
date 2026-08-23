"use client";
import { useCallback, useRef, useState } from "react";
import { CheckCircle2, FileText, ImageIcon, RotateCcw, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── The upload kit ─────────────────────────────────────────────────────────
   Market-grade upload UX, shared by every uploader in the app:
   • real progress (XHR upload events — fetch can't report progress)
   • explicit phases: checking → optimizing → uploading NN% → saving → done/error
   • allowed types + size limit stated up front and enforced BEFORE upload
   • live preview for images, file chip for documents, retry on failure     */

export const MAX_UPLOAD_MB = 10; // must match /api/upload

export type Phase = "idle" | "optimizing" | "preparing" | "uploading" | "saving" | "done" | "error";
export type UploadState = { phase: Phase; pct: number; message: string };
export const IDLE: UploadState = { phase: "idle", pct: 0, message: "" };

const fmtMb = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** PUT with real progress reporting. */
function putWithProgress(url: string, file: Blob, contentType: string, onPct: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onPct(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300)
      ? resolve() : reject(new Error(`Storage rejected the file (HTTP ${xhr.status})`));
    xhr.onerror = () => reject(new Error("Network error during upload — check your connection"));
    xhr.ontimeout = () => reject(new Error("Upload timed out — try again"));
    xhr.send(file);
  });
}

/** Downscale an image to ≤maxPx JPEG client-side (phone photo 4MB → ~40KB). */
export async function optimizeImage(file: File, maxPx = 512): Promise<File> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxPx / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch { return file; }
}

/** Full pipeline: validate → (optimize) → presign → PUT with progress → save.
 *  Every step updates `state` so the user always knows what is happening. */
export function useR2Upload(opts: {
  kind: string;                       // /api/upload kind: photo | logo | document
  accept: string[];                   // mime prefixes/types, e.g. ["image/jpeg","image/png"]
  acceptLabel: string;                // human label, e.g. "JPG, PNG or WebP"
  optimize?: boolean;                 // downscale images before upload
  save: (key: string) => Promise<{ ok?: boolean; error?: string } | void | null>;
}) {
  const [state, setState] = useState<UploadState>(IDLE);
  const lastFile = useRef<File | null>(null);
  // latest options every render — memoizing over them would freeze the save
  // callback's closure (e.g. a `file` state variable) at first render
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const run = useCallback(async (raw: File) => {
    const opts = optsRef.current;
    lastFile.current = raw;
    const okType = opts.accept.some((a) => a.endsWith("/*") ? raw.type.startsWith(a.slice(0, -1)) : raw.type === a);
    if (!okType)
      return setState({ phase: "error", pct: 0, message: `“${raw.name}” is not a supported type — use ${opts.acceptLabel}.` });
    if (raw.size > MAX_UPLOAD_MB * 1024 * 1024)
      return setState({ phase: "error", pct: 0, message: `File is ${fmtMb(raw.size)} — the limit is ${MAX_UPLOAD_MB} MB.` });
    try {
      let file = raw;
      if (opts.optimize && raw.type.startsWith("image/")) {
        setState({ phase: "optimizing", pct: 0, message: "Optimizing image…" });
        file = await optimizeImage(raw);
      }
      setState({ phase: "preparing", pct: 0, message: "Preparing secure upload…" });
      const res = await fetch("/api/upload", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: opts.kind, contentType: file.type || "application/octet-stream", size: file.size }),
      });
      if (!res.ok) {
        const why = res.status === 503 ? "File storage is not configured yet"
          : res.status === 413 ? `File is over the ${MAX_UPLOAD_MB} MB limit` : "Could not start the upload";
        return setState({ phase: "error", pct: 0, message: why + "." });
      }
      const { url, key } = await res.json();
      setState({ phase: "uploading", pct: 0, message: "Uploading… 0%" });
      await putWithProgress(url, file, file.type || "application/octet-stream",
        (pct) => setState({ phase: "uploading", pct, message: `Uploading… ${pct}%` }));
      setState({ phase: "saving", pct: 100, message: "Saving to the file…" });
      const saved = await opts.save(key);
      if (saved && "error" in saved && saved.error)
        return setState({ phase: "error", pct: 0, message: saved.error });
      setState({ phase: "done", pct: 100, message: "Uploaded ✓" });
    } catch (e) {
      setState({ phase: "error", pct: 0, message: e instanceof Error ? e.message : "Upload failed — try again." });
    }
  }, []);

  const retry = useCallback(() => { if (lastFile.current) run(lastFile.current); }, [run]);
  const reset = useCallback(() => setState(IDLE), []);
  const busy = ["optimizing", "preparing", "uploading", "saving"].includes(state.phase);
  return { state, run, retry, reset, busy };
}

/** Slim brand progress bar with phase label — the heartbeat of every upload. */
export function UploadProgress({ state, onRetry }: { state: UploadState; onRetry?: () => void }) {
  if (state.phase === "idle") return null;
  if (state.phase === "error")
    return (
      <div className="mt-2 flex items-start justify-between gap-2 rounded-md bg-danger/10 px-3 py-2">
        <p className="text-[13.5px] leading-snug text-danger">{state.message}</p>
        {onRetry && (
          <button type="button" onClick={onRetry}
            className="flex shrink-0 items-center gap-1 rounded border border-danger/30 px-2 py-0.5 text-[12.5px] font-medium text-danger hover:bg-danger/10">
            <RotateCcw size={11} /> Retry
          </button>
        )}
      </div>
    );
  if (state.phase === "done")
    return (
      <p className="mt-2 flex items-center gap-1.5 text-[13.5px] font-medium text-success">
        <CheckCircle2 size={14} /> {state.message}
      </p>
    );
  const indeterminate = state.phase !== "uploading";
  return (
    <div className="mt-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full bg-primary transition-[width] duration-200",
            indeterminate && "animate-pulse")}
          style={{ width: indeterminate ? "100%" : `${state.pct}%`, opacity: indeterminate ? 0.35 : 1 }} />
      </div>
      <p className="mt-1 text-[13px] text-muted-foreground" aria-live="polite">{state.message}</p>
    </div>
  );
}

/** Drag-and-drop target + click-to-browse, with the rules printed on it. */
export function Dropzone({ accept, acceptLabel, disabled, onFile, icon = "file", compact }: {
  accept: string; acceptLabel: string; disabled?: boolean;
  onFile: (f: File) => void; icon?: "file" | "image"; compact?: boolean;
}) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const Icon = icon === "image" ? ImageIcon : UploadCloud;
  return (
    <button type="button" disabled={disabled}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault(); setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={cn(
        "flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed text-center transition-colors",
        compact ? "gap-1 px-4 py-4" : "gap-1.5 px-6 py-7",
        over ? "border-primary bg-brand-soft" : "border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/60",
        disabled && "cursor-not-allowed opacity-50",
      )}>
      <Icon size={compact ? 18 : 22} className={cn("text-muted-foreground", over && "text-primary")} />
      <span className="text-[14px] font-medium">
        {over ? "Drop to upload" : <>Drag a file here or <span className="text-primary underline underline-offset-2">browse</span></>}
      </span>
      <span className="text-[12.5px] text-muted-foreground">{acceptLabel} · up to {MAX_UPLOAD_MB} MB</span>
      <input ref={inputRef} type="file" accept={accept} className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = ""; // same file can be picked again after an error
        }} />
    </button>
  );
}

/** Chip describing the picked document: icon, name, human size, clear. */
export function FileChip({ file, onClear, disabled }: { file: File; onClear: () => void; disabled?: boolean }) {
  const isImg = file.type.startsWith("image/");
  return (
    <div className="flex items-center gap-2.5 rounded-md border border-border bg-card px-3 py-2">
      {isImg
        ? <ImageIcon size={16} className="shrink-0 text-primary" />
        : <FileText size={16} className="shrink-0 text-primary" />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium">{file.name}</p>
        <p className="text-[12.5px] text-muted-foreground">
          {(file.type || "unknown type").replace("application/", "")} · {fmtMb(file.size)}
        </p>
      </div>
      {!disabled && (
        <button type="button" onClick={onClear} aria-label="Remove file"
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
