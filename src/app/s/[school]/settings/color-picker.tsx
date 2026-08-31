"use client";
import { useRef, useState } from "react";

const SEEDS = [["#5E1D3E", "Wine"], ["#126B4A", "Palm"], ["#8A4A21", "Cocoa"],
  ["#2F3E7A", "Indigo"], ["#0E5D74", "Lagoon"]] as const;

/** The school colour: a free picker — schools bring their own brand and we
 *  can't predict it — with the checked seeds beside it as one-tap shortcuts. */
export function SchoolColorPicker({ defaultValue }: { defaultValue: string }) {
  const [color, setColor] = useState(defaultValue || "#5E1D3E");
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input ref={inputRef} name="primaryColor" type="color" defaultValue={color}
        onChange={(e) => setColor(e.target.value)} aria-label="School colour"
        className="h-10 w-20 cursor-pointer rounded-md border border-border bg-card p-1" />
      <span className="font-mono text-[11.5px] uppercase text-muted-foreground" data-nums="">{color}</span>
      <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
      {SEEDS.map(([hex, name]) => (
        <button key={hex} type="button" title={name}
          onClick={() => { if (inputRef.current) inputRef.current.value = hex; setColor(hex); }}
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] font-medium transition-colors ${
            color.toUpperCase() === hex ? "border-primary/50 bg-brand-container text-on-brand-container" : "border-border hover:bg-muted"}`}>
          <span className="h-3.5 w-3.5 rounded-full" style={{ background: hex }} />
          {name}
        </button>
      ))}
    </div>
  );
}
