/* eslint-disable @next/next/no-img-element */

/* Signature & stamp blocks for printed papers. The collected signature sits
 * ON the line, the office label under it, and the signer's name beneath —
 * so every paper leaves the school ready, printed or digital. */

/** One signing line. `stampUrl` places the school stamp beside the
 *  signature (leaving certificates say "signature & stamp" on one line). */
export function SignLine({ label, sigUrl, name, stampUrl }: {
  label: string; sigUrl?: string | null; name?: string | null; stampUrl?: string | null;
}) {
  return (
    <div className="text-center text-neutral-600">
      <div className="flex h-12 items-end justify-center gap-2">
        {sigUrl && <img src={sigUrl} alt="" data-sig="" className="max-h-12 max-w-[150px] object-contain" />}
        {stampUrl && <img src={stampUrl} alt="" data-stamp="" className="max-h-12 max-w-[70px] object-contain opacity-90" />}
      </div>
      <div className="border-t border-neutral-400 pt-1">
        {label}
        {name && <span className="block text-[10.5px] text-neutral-500">{name}</span>}
      </div>
    </div>
  );
}

/** The stamp's own slot on papers that give it a separate line. */
export function StampSlot({ url, label = "School stamp" }: { url?: string | null; label?: string }) {
  return (
    <div className="text-center text-neutral-600">
      <div className="flex h-12 items-end justify-center">
        {url && <img src={url} alt="" data-stamp="" className="max-h-12 object-contain opacity-90" />}
      </div>
      <div className="border-t border-neutral-400 pt-1">{label}</div>
    </div>
  );
}
