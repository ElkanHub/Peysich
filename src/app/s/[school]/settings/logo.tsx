"use client";
import { useState } from "react";
import { saveLogo } from "../actions-grading";

export function LogoUploader({ slug, enabled }: { slug: string; enabled: boolean }) {
  const [status, setStatus] = useState("");
  if (!enabled)
    return <p className="text-xs text-muted-foreground">Logo upload activates once file storage (R2) is configured.</p>;
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">School logo</label>
      <input type="file" accept="image/*" className="text-sm"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setStatus("Uploading…");
          const res = await fetch("/api/upload", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kind: "logo", contentType: file.type, size: file.size }),
          });
          if (!res.ok) return setStatus("Upload failed");
          const { url, key } = await res.json();
          const put = await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
          if (!put.ok) return setStatus("Upload failed");
          const r = await saveLogo(slug, key);
          setStatus(r && "ok" in r ? "Logo saved ✓" : "Failed");
        }} />
      {status && <p className="mt-1 text-xs text-muted-foreground">{status}</p>}
    </div>
  );
}
