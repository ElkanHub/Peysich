"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";

/** A framed risograph image on the drafting paper. Until the generated file
 *  lands in public/marketing/, the frame shows its own filename in the wine
 *  duotone — so the page reads correctly with or without the art. */
export function Riso({ file, alt, ratio = "4/3", caption, className, priority }: {
  file: string; alt: string; ratio?: string; caption?: string; className?: string; priority?: boolean;
}) {
  const [missing, setMissing] = useState(false);
  return (
    <figure className={cn("riso relative overflow-hidden border border-[#221a22] bg-[#5E1D3E]", className)} style={{ aspectRatio: ratio }}>
      {!missing && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/marketing/${file}`} alt={alt} onError={() => setMissing(true)}
          // a 404 that fired before hydration never reaches onError — read it off the element
          ref={(el) => { if (el && el.complete && el.naturalWidth === 0) setMissing(true); }}
          loading={priority ? "eager" : "lazy"} decoding="async"
          className="absolute inset-0 h-full w-full object-cover" />
      )}
      {missing && (
        <div className="riso-ph absolute inset-0 flex items-center justify-center p-5 text-center font-mono text-[12px] leading-relaxed text-[#f2dce8]">
          public/marketing/{file}
        </div>
      )}
      {caption && (
        <figcaption className="absolute bottom-3 right-3 z-[2] hidden items-center sm:flex gap-2 bg-[#E8DFD0]/95 px-2 py-1 text-[12.5px] font-medium text-[#221a22]">
          <span className="inline-block h-4 w-4 bg-[#E58A2E]" aria-hidden />{caption}
        </figcaption>
      )}
    </figure>
  );
}
