"use client";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { PenLine, Smartphone, Stamp, X } from "lucide-react";
import { btnGhostCls } from "@/ui/kit";
import { SignaturePad } from "@/ui/signature-pad";
import { UploadProgress, useR2Upload, MAX_UPLOAD_MB } from "@/ui/upload";
import { saveDocImage, createSignToken, type DocImageSlot } from "./docsign-actions";

const TYPES = ["image/png", "image/jpeg", "image/webp"];
const LABEL = "PNG, JPG or WebP";

function Modal({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-lg)]"
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-semibold">{title}</p>
          <button type="button" onClick={onClose} aria-label="Close"
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** QR bridge to the phone: mint a token, show the code, poll until the
 *  phone delivers — then the new image appears right here. */
function PhoneQR({ slug, slot, stamp, onDone, onClose }: {
  slug: string; slot: DocImageSlot; stamp: boolean;
  onDone: (url: string | null) => void; onClose: () => void;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "waiting" | "expired" | "error">("loading");
  const stop = useRef(false);

  useEffect(() => {
    stop.current = false;
    (async () => {
      const res = await createSignToken(slug, slot);
      if (!("token" in res) || !res.token) return setState("error");
      const url = `${window.location.origin}/sign/${res.token}`;
      setLink(url);
      setQr(await QRCode.toDataURL(url, { width: 260, margin: 1 }));
      setState("waiting");
      while (!stop.current) {
        await new Promise((r) => setTimeout(r, 2500));
        if (stop.current) return;
        try {
          const s = await (await fetch(`/api/sign/${res.token}`)).json();
          if (s.state === "done") { onDone(s.url ?? null); return; }
          if (s.state === "expired" || s.state === "invalid") { setState("expired"); return; }
        } catch { /* keep polling — a blip shouldn't kill the wait */ }
      }
    })();
    return () => { stop.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="text-center">
      {state === "error" && (
        <p className="rounded-md bg-danger/10 px-3 py-2 text-[13.5px] text-danger">
          Could not start a phone-signing session — please try again.
        </p>
      )}
      {state === "expired" && (
        <p className="rounded-md bg-warning-soft px-3 py-2 text-[13.5px] text-warning">
          That code expired (they last 15 minutes). Close and open a fresh one.
        </p>
      )}
      {(state === "loading" || state === "waiting") && (
        <>
          <div className="mx-auto flex h-[260px] w-[260px] items-center justify-center rounded-lg border border-border bg-white p-2">
            {qr
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={qr} alt="Scan to sign on your phone" data-signqr="" className="h-full w-full" />
              : <span className="text-[13px] text-muted-foreground">Preparing…</span>}
          </div>
          <p className="mt-3 text-[14px] font-medium">
            Scan with your phone&apos;s camera, then {stamp ? "photograph the stamp" : "sign on the screen"}.
          </p>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            It saves straight to the app — this window notices by itself. Code lasts 15 minutes.
          </p>
          {link && (
            <p className="mt-2 break-all text-[11px] text-faint" data-signlink="">{link}</p>
          )}
        </>
      )}
      <button type="button" onClick={onClose} className={btnGhostCls + " mt-4"}>Close</button>
    </div>
  );
}

/** One signature / stamp slot: preview + three ways in — upload a file,
 *  draw it right here, or hand it to a phone via QR code. */
export function DocImageUploader({ slug, slot, label, hint, enabled, currentUrl, stamp }: {
  slug: string; slot: DocImageSlot; label: string; hint: string;
  enabled: boolean; currentUrl?: string | null; stamp?: boolean;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [modal, setModal] = useState<"draw" | "qr" | null>(null);
  const [phoneSaved, setPhoneSaved] = useState(false);
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
      <div className="flex items-center gap-3.5">
        <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white ${stamp ? "h-16 w-16" : "h-14 w-28"}`}>
          {shown
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={shown} alt={label} className="h-full w-full object-contain" />
            : <Icon size={18} className="text-muted-foreground" />}
        </span>
        <p className="min-w-0 text-[12.5px] text-muted-foreground">
          {hint} · {LABEL}, up to {MAX_UPLOAD_MB} MB
        </p>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {!stamp && (
          <button type="button" disabled={up.busy} onClick={() => setModal("draw")}
            className={btnGhostCls + " whitespace-nowrap disabled:opacity-50"} data-draw="">
            <PenLine size={13} className="mr-1 inline" />Draw
          </button>
        )}
        <button type="button" disabled={up.busy} onClick={() => { setPhoneSaved(false); setModal("qr"); }}
          className={btnGhostCls + " whitespace-nowrap disabled:opacity-50"} data-phone="">
          <Smartphone size={13} className="mr-1 inline" />{stamp ? "Photo on phone" : "Sign on phone"}
        </button>
        <button type="button" disabled={up.busy} onClick={() => inputRef.current?.click()}
          className={btnGhostCls + " whitespace-nowrap disabled:opacity-50"}>
          {shown ? "Replace…" : "Upload…"}
        </button>
      </div>
      <input ref={inputRef} type="file" accept={TYPES.join(",")} className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (f.type.startsWith("image/")) setPreview(URL.createObjectURL(f));
          up.run(f);
          e.target.value = "";
        }} />
      <UploadProgress state={up.state} onRetry={up.retry} />
      {phoneSaved && (
        <p className="mt-2 text-[13.5px] font-medium text-success" data-phone-saved="">Saved from the phone ✓</p>
      )}

      {modal === "draw" && (
        <Modal title={`Draw — ${label.toLowerCase()}`} onClose={() => setModal(null)}>
          <SignaturePad saving={up.busy}
            onSave={(file) => {
              setPreview(URL.createObjectURL(file));
              setModal(null);
              up.run(file);
            }} />
          <p className="mt-2.5 text-[12.5px] text-muted-foreground">
            Tip: a mouse is clumsy — <b>Sign on phone</b> gives you a finger-friendly pad.
          </p>
        </Modal>
      )}
      {modal === "qr" && (
        <Modal title={stamp ? "Photograph the stamp on your phone" : `Sign on your phone — ${label.toLowerCase()}`}
          onClose={() => setModal(null)}>
          <PhoneQR slug={slug} slot={slot} stamp={!!stamp}
            onDone={(url) => {
              if (url) setPreview(url);
              setPhoneSaved(true);
              setModal(null);
            }}
            onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}
