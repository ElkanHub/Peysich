"use client";
import { useRef, useState } from "react";
import { inputCls, btnGhostCls } from "@/ui/kit";
import { setStudentPhoto, addStudentFile } from "./actions";

/** Browser → /api/upload (presign) → PUT to R2. Returns the object key. */
async function uploadToR2(kind: string, file: File): Promise<string | null> {
  const res = await fetch("/api/upload", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, contentType: file.type || "application/octet-stream", size: file.size }),
  });
  if (!res.ok) return null;
  const { url, key } = await res.json();
  const put = await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
  return put.ok ? key : null;
}

export function PhotoUploader({ slug, studentId, enabled }: {
  slug: string; studentId: string; enabled: boolean;
}) {
  const [status, setStatus] = useState("");
  if (!enabled)
    return <p className="text-xs text-muted-foreground">Photo upload activates once file storage (R2) is configured.</p>;
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">Profile photo</label>
      <input type="file" accept="image/*" className="text-sm"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setStatus("Uploading…");
          const key = await uploadToR2("photo", file);
          if (!key) return setStatus("Upload failed — try again.");
          const r = await setStudentPhoto(slug, studentId, key);
          setStatus(r && "ok" in r ? "Photo saved ✓" : "Failed");
        }} />
      {status && <p className="mt-1 text-xs text-muted-foreground">{status}</p>}
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

export function DocumentUploader({ slug, studentId }: { slug: string; studentId: string }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} className="grid grid-cols-2 gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const file = f.get("file") as File | null;
        const title = String(f.get("title") ?? "").trim();
        if (!file || file.size === 0 || !title) return setStatus("Pick a file and give it a title.");
        setBusy(true); setStatus("Uploading…");
        const key = await uploadToR2("document", file);
        if (!key) { setBusy(false); return setStatus("Upload failed — try again."); }
        const r = await addStudentFile(slug, studentId, {
          kind: String(f.get("kind") || "other"), title,
          fileKey: key, note: String(f.get("note") ?? "").trim() || undefined,
        });
        setBusy(false);
        if (r && "ok" in r) { setStatus("Document added ✓"); formRef.current?.reset(); }
        else setStatus("Failed to save.");
      }}>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Document type</label>
        <select name="kind" className={inputCls}>
          {DOC_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Title</label>
        <input name="title" required placeholder="Birth certificate — scanned copy" className={inputCls} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">File (PDF or image, max 10 MB)</label>
        <input name="file" type="file" required accept="image/*,.pdf" className="w-full text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Note (optional)</label>
        <input name="note" placeholder="Original kept by parent" className={inputCls} />
      </div>
      <div className="col-span-2 flex items-center gap-3">
        <button disabled={busy} className={btnGhostCls}>{busy ? "Uploading…" : "Upload document"}</button>
        {status && <span className="text-xs text-muted-foreground">{status}</span>}
      </div>
    </form>
  );
}
