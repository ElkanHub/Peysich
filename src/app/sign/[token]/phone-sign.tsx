"use client";
import { useRef, useState } from "react";
import { Camera, CheckCircle2 } from "lucide-react";
import { SignaturePad } from "@/ui/signature-pad";

/** Draw the signature (or photograph the stamp) and deliver it straight to
 *  the app — the computer that showed the QR code picks it up by itself. */
export function PhoneSign({ token, slotLabel, stamp }: {
  token: string; slotLabel: string; stamp: boolean;
}) {
  const [phase, setPhase] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const send = async (file: File) => {
    setPhase("saving");
    try {
      const res = await fetch(`/api/sign/${token}`, {
        method: "POST", headers: { "Content-Type": file.type }, body: file,
      });
      setPhase(res.ok ? "done" : "error");
    } catch {
      setPhase("error");
    }
  };

  if (phase === "done")
    return (
      <div className="my-auto text-center" data-phone-done="">
        <CheckCircle2 size={44} className="mx-auto text-success" />
        <p className="mt-3 text-lg font-semibold">Saved to the app ✓</p>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          The {slotLabel.toLowerCase()} is in place — your computer will show it in a moment.
          You can close this page.
        </p>
      </div>
    );

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="mt-4 text-xl font-bold">{slotLabel}</h1>
      <p className="mt-1 text-[14px] text-muted-foreground">
        {stamp
          ? "Photograph the stamp straight on — dark ink on white paper shows best on printed documents."
          : "Sign below exactly as you would on paper. It lands on report cards, offer letters and certificates."}
      </p>

      <div className="mt-5">
        {stamp ? (
          <div>
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Stamp preview" className="mx-auto max-h-64 rounded-lg border border-border object-contain" />
            ) : (
              <button type="button" onClick={() => inputRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 px-6 py-12 text-center">
                <Camera size={28} className="text-muted-foreground" />
                <span className="text-[15px] font-medium">Take a photo of the stamp</span>
                <span className="text-[12.5px] text-muted-foreground">or choose one from your gallery</span>
              </button>
            )}
            <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp"
              capture="environment" className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setPhoto(f); setPreview(URL.createObjectURL(f));
                e.target.value = "";
              }} />
            {preview && (
              <div className="mt-3 flex items-center gap-2">
                <button type="button" onClick={() => { setPhoto(null); setPreview(null); }}
                  disabled={phase === "saving"}
                  className="rounded-md border border-border px-3 py-2 text-[13.5px] font-medium">
                  Retake
                </button>
                <button type="button" onClick={() => photo && send(photo)} disabled={phase === "saving"}
                  className="ml-auto rounded-md bg-primary px-5 py-2 text-[14px] font-semibold text-primary-foreground disabled:opacity-50">
                  {phase === "saving" ? "Saving…" : "Save to the app"}
                </button>
              </div>
            )}
          </div>
        ) : (
          <SignaturePad onSave={send} saving={phase === "saving"} saveLabel="Save to the app" />
        )}
      </div>

      {phase === "error" && (
        <p className="mt-3 rounded-md bg-danger/10 px-3 py-2 text-[13.5px] text-danger">
          That didn&apos;t save — check your connection and try again. If the link has expired,
          scan a fresh QR code from Settings.
        </p>
      )}
    </div>
  );
}
