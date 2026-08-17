"use client";
import { useState, useTransition } from "react";
import { submitHomework } from "../../portal-actions";
import { Card, btnCls, inputCls } from "@/ui/kit";

/** Student hand-in: note + optional photo/file straight to R2 (doc 10). */
export function SubmitHomework({ slug, assignmentId, uploadsEnabled, existingNote, submittedAt }: {
  slug: string; assignmentId: string; uploadsEnabled: boolean;
  existingNote: string; submittedAt: string | null;
}) {
  const [note, setNote] = useState(existingNote);
  const [fileKey, setFileKey] = useState("");
  const [status, setStatus] = useState("");
  const [pending, start] = useTransition();

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("Uploading…");
    const res = await fetch("/api/upload", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "submission", contentType: file.type || "application/octet-stream", size: file.size }),
    });
    if (!res.ok) return setStatus("Upload failed");
    const { url, key } = await res.json();
    const put = await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
    if (!put.ok) return setStatus("Upload failed");
    setFileKey(key);
    setStatus(`Attached: ${file.name}`);
  }

  return (
    <Card>
      {submittedAt && (
        <p className="mb-2 text-sm text-success">
          Submitted {submittedAt.slice(0, 10)} — you can resubmit to replace it.
        </p>
      )}
      <form action={(f) => start(async () => {
        f.set("fileKey", fileKey);
        const r = await submitHomework(slug, assignmentId, f);
        setStatus(r && "ok" in r ? "Submitted ✓" : (r as { error?: string })?.error ?? "Failed");
      })}>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Your answer / notes</label>
        <textarea name="note" value={note} onChange={(e) => setNote(e.target.value)}
          rows={4} className={inputCls} />
        {uploadsEnabled ? (
          <div className="mt-2">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Attach a photo of your work (camera works)
            </label>
            <input type="file" accept="image/*,.pdf" capture="environment" onChange={pickFile}
              className="text-sm" />
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">File uploads are enabled once storage is configured.</p>
        )}
        {status && <p className="mt-2 text-xs text-muted-foreground">{status}</p>}
        <button disabled={pending} className={btnCls + " mt-3"}>
          {pending ? "Submitting…" : "Submit homework"}
        </button>
      </form>
    </Card>
  );
}
