"use client";
import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { authClient, useSession } from "@/lib/auth-client";
import { Card, Field, inputCls, btnCls, btnGhostCls } from "@/ui/kit";
import { SubmitButton } from "@/ui/feedback";
import { useR2Upload, UploadProgress } from "@/ui/upload";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const IMAGE_LABEL = "JPG, PNG or WebP";

/** The client half of My Account: avatar, profile, password. */
export function AccountCards() {
  const { data: session } = useSession();
  const [name, setName] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const u = session?.user as { name: string; email: string } | undefined;

  return (
    <>
      <AvatarCard />
      <Card>
        <h2 className="font-semibold">Profile</h2>
        <form className="mt-3 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const { error } = await authClient.updateUser({ name: name ?? u?.name ?? "" });
            setMsg(error ? error.message ?? "Failed" : "Saved ✓");
          }}>
          <Field label="Full name">
            <input value={name ?? u?.name ?? ""} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Email / login">
            <input value={u?.email ?? ""} disabled className={inputCls + " opacity-60"} />
          </Field>
          <SubmitButton className={btnCls}>Save</SubmitButton>
          {msg && <span className="ml-2 text-sm text-success">{msg}</span>}
        </form>
      </Card>
      <Card>
        <h2 className="font-semibold">Change password</h2>
        <form className="mt-3 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const { error } = await authClient.changePassword({
              currentPassword: String(f.get("current")),
              newPassword: String(f.get("next")),
              revokeOtherSessions: true,
            });
            setPwMsg(error ? error.message ?? "Failed" : "Password changed ✓ (other sessions signed out)");
          }}>
          <Field label="Current password"><input name="current" type="password" required className={inputCls} /></Field>
          <Field label="New password (min 8)"><input name="next" type="password" minLength={8} required className={inputCls} /></Field>
          <SubmitButton className={btnCls}>Change password</SubmitButton>
          {pwMsg && <p className="text-sm text-success">{pwMsg}</p>}
        </form>
      </Card>
    </>
  );
}

/** The user's OWN in-app picture — nothing to do with the photos the school
 *  collects for documents. Shows in the sidebar next to their name. */
function AvatarCard() {
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const up = useR2Upload({
    kind: "photo", accept: IMAGE_TYPES, acceptLabel: IMAGE_LABEL, optimize: true,
    save: async (key) => { await authClient.updateUser({ image: key }); },
  });

  return (
    <Card>
      <h2 className="font-semibold">Profile picture</h2>
      <p className="mt-0.5 text-[13.5px] text-muted-foreground">
        Only shows inside the app (sidebar) — separate from any photo the school keeps on documents.
      </p>
      <div className="mt-3 flex items-center gap-4">
        <span className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft ring-1 ring-border">
          {preview
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={preview} alt="" className="h-full w-full object-cover" />
            : <Camera size={20} className="text-primary/60" />}
          {up.busy && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-[12px] font-semibold text-white">
              {up.state.phase === "uploading" ? `${up.state.pct}%` : "…"}
            </span>
          )}
        </span>
        <div>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={up.busy}
            className={btnGhostCls + " disabled:opacity-50"}>
            Choose picture
          </button>
          <p className="mt-1 text-[12px] text-muted-foreground">{IMAGE_LABEL}, up to 10 MB.</p>
          <input ref={inputRef} type="file" accept={IMAGE_TYPES.join(",")} className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setPreview(URL.createObjectURL(f));
              up.run(f);
            }} />
        </div>
      </div>
      <UploadProgress state={up.state} onRetry={up.retry} />
      {up.state.phase === "done" && (
        <p className="mt-1 text-[13px] text-success">Saved ✓ — it appears in your sidebar on the next page load.</p>
      )}
    </Card>
  );
}
