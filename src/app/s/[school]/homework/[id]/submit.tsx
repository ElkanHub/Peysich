"use client";
import { useRef, useState, useTransition } from "react";
import { submitHomework } from "../../portal-actions";
import { Card, btnCls, btnGhostCls, inputCls } from "@/ui/kit";

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/** Student hand-in: a photo (camera or gallery) and/or a typed answer, straight
 *  to R2. Hand in stays grey until there is something to hand in. */
export function SubmitHomework({ slug, assignmentId, uploadsEnabled, existingNote, hasFile, submittedAt }: {
  slug: string; assignmentId: string; uploadsEnabled: boolean;
  existingNote: string; hasFile: boolean; submittedAt: string | null;
}) {
  const [note, setNote] = useState(existingNote);
  const [fileKey, setFileKey] = useState("");
  const [upload, setUpload] = useState<"" | "busy" | "done" | "failed">("");
  const [error, setError] = useState("");
  const [handedAt, setHandedAt] = useState<string | null>(submittedAt);
  const [editing, setEditing] = useState(!submittedAt);
  const [pending, start] = useTransition();
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUpload("busy"); setError("");
    try {
      const res = await fetch("/api/upload", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "submission", contentType: file.type || "application/octet-stream", size: file.size }),
      });
      if (!res.ok) throw new Error();
      const { url, key } = await res.json();
      const put = await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!put.ok) throw new Error();
      setFileKey(key); setUpload("done");
    } catch { setUpload("failed"); }
  }

  const canHandIn = upload !== "busy" && (upload === "done" || note.trim() !== "" || hasFile);

  if (handedAt && !editing) {
    return (
      <Card className="text-center">
        <p className="text-2xl font-bold text-success">Handed in at {hhmm(handedAt)} ✓</p>
        <button type="button" onClick={() => setEditing(true)} className={btnGhostCls + " mt-3"}>
          Change what I handed in
        </button>
      </Card>
    );
  }

  return (
    <Card>
      <form action={(f) => start(async () => {
        f.set("fileKey", fileKey);
        const r = await submitHomework(slug, assignmentId, f);
        if (r && "ok" in r) { setHandedAt(r.submittedAt ?? null); setEditing(false); setError(""); }
        else setError((r as { error?: string })?.error ?? "That didn’t go through — please try again");
      })}>
        {uploadsEnabled ? (
          <div className="mb-3">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Your work</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => camera.current?.click()} disabled={upload === "busy"} className={btnCls}>
                Take a photo of your work
              </button>
              <button type="button" onClick={() => gallery.current?.click()} disabled={upload === "busy"} className={btnGhostCls}>
                Choose a file
              </button>
            </div>
            <input ref={camera} type="file" accept="image/*" capture="environment" onChange={pickFile} className="hidden" />
            <input ref={gallery} type="file" accept="image/*,.pdf" onChange={pickFile} className="hidden" />
            <p className={`mt-2 text-sm ${upload === "done" ? "font-medium text-success" : upload === "failed" ? "text-danger" : "text-muted-foreground"}`}>
              {upload === "busy" ? "Uploading…" : upload === "done" ? "Photo attached ✓"
                : upload === "failed" ? "The upload didn’t finish — try again" : hasFile ? "Your earlier photo is still attached" : ""}
            </p>
          </div>
        ) : (
          <p className="mb-3 text-xs text-muted-foreground">Photo uploads switch on once the school sets up storage — type your answer below.</p>
        )}
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Or type your answer</label>
        <textarea name="note" value={note} onChange={(e) => setNote(e.target.value)} rows={4} className={inputCls} />
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <button disabled={pending || !canHandIn} className={btnCls + " mt-3 w-full py-3 text-base disabled:opacity-50"}>
          {pending ? "Handing in…" : "Hand in"}
        </button>
      </form>
    </Card>
  );
}
