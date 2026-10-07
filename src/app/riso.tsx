"use client";
import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/** A risograph print pinned to the drafting paper: white mat, hard offset
 *  shadow, two strips of tape, a touch of tilt, and an optional hand-written
 *  note underneath. Until the generated file lands in public/marketing/, the
 *  frame shows its own filename in the wine duotone — so the page reads
 *  correctly with or without the art. */
export function Riso({ file, alt, ratio = "4/3", caption, note, tilt = 0, className, priority }: {
  file: string; alt: string; ratio?: string; caption?: string; note?: string; tilt?: number; className?: string; priority?: boolean;
}) {
  const [missing, setMissing] = useState(false);
  return (
    <figure className={cn("relative", className)} style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}>
      <div className="border border-[#221a22] bg-white p-2 shadow-[6px_6px_0_#221a22] sm:p-2.5">
        <div className="riso relative overflow-hidden border border-[#d6cfd4] bg-[#5E1D3E]" style={{ aspectRatio: ratio }}>
          {!missing && (
            <Image src={`/marketing/${file}`} alt={alt} fill onError={() => setMissing(true)}
              priority={priority} sizes="(max-width: 640px) 100vw, (max-width: 1040px) 90vw, 1000px"
              className="object-cover" />
          )}
          {missing && (
            <div className="riso-ph absolute inset-0 flex items-center justify-center p-5 text-center font-mono text-[12px] leading-relaxed text-[#f2dce8]">
              public/marketing/{file}
            </div>
          )}
          {caption && (
            <span className="absolute bottom-3 right-3 z-[2] hidden items-center gap-2 bg-[#E8DFD0]/95 px-2 py-1 text-[12.5px] font-medium text-[#221a22] sm:flex">
              <span className="inline-block h-4 w-4 bg-[#E58A2E]" aria-hidden />{caption}
            </span>
          )}
        </div>
      </div>
      {/* masking tape, same strip the pinned dashboard uses */}
      <span aria-hidden className="riso-tape -left-2 top-3 -rotate-[38deg]" />
      <span aria-hidden className="riso-tape -right-2 top-3 rotate-[38deg]" />
      {note && <figcaption className="mk-hand mt-3.5 !text-[12px]">{note}</figcaption>}
    </figure>
  );
}
