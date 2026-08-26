/* Server-rendered chart primitives for the analytics tabs. All values are
 * direct-labeled (never color-alone) and every chart sits beside a table or
 * list, so the numbers survive any theme, printer, or colorblindness.
 * Palette (CVD-validated): money #A33268 · attendance #0084B8 ·
 * learning #6455CC · people #A8690A. */

export const PILLAR = {
  money: "#A33268", attendance: "#0084B8", learning: "#6455CC", people: "#A8690A",
} as const;
/** Sequential wine ramp, light → dark = small → large / recent → old. */
export const SEQ = ["#E3AECB", "#C97FA8", "#A33268", "#6E1F46"];

/** Horizontal labeled bars — funnels, aging buckets, subject averages. */
export function HBars({ rows, color, colors, refLine }: {
  rows: { label: string; v: number; display: string; faded?: boolean }[];
  color?: string; colors?: string[];
  /** Optional dashed reference at this fraction of max (0..1), e.g. school avg. */
  refLine?: { at: number; label: string };
}) {
  const max = Math.max(1, ...rows.map((r) => r.v));
  return (
    <div className="space-y-1.5" data-nums="">
      {rows.map((r, i) => (
        <div key={r.label + i} className="flex items-center gap-2">
          <span className="w-26 shrink-0 truncate text-right text-[12px] text-muted-foreground">{r.label}</span>
          <span className="relative h-4 min-w-0 flex-1">
            <span className="absolute inset-y-0 left-0 rounded-[4px]"
              style={{
                width: `${Math.max(0.75, (r.v / max) * 100)}%`,
                background: colors?.[i] ?? color ?? "#A33268",
                opacity: r.faded ? 0.55 : 1,
              }} />
            {refLine && (
              <span title={refLine.label}
                className="absolute -inset-y-0.5 border-l-[1.5px] border-dashed border-faint"
                style={{ left: `${Math.min(100, refLine.at * 100)}%` }} />
            )}
          </span>
          <span className="w-20 shrink-0 whitespace-nowrap text-[12px] font-semibold">{r.display}</span>
        </div>
      ))}
    </div>
  );
}

/** One-hue column chart — grade spread, lates by weekday. */
export function Columns({ bins, color }: {
  bins: { label: string; n: number }[]; color: string;
}) {
  const max = Math.max(1, ...bins.map((b) => b.n));
  return (
    <div className="flex items-end gap-1.5" style={{ height: 120 }} data-nums="">
      {bins.map((b) => (
        <div key={b.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1 self-stretch">
          <span className="text-[10.5px] font-semibold text-muted-foreground">{b.n || ""}</span>
          <span className="w-full rounded-t-[4px]"
            style={{ height: `${Math.max(b.n ? 4 : 1, (b.n / max) * 78)}%`, background: color, opacity: b.n ? 1 : 0.25 }} />
          <span className="text-[10.5px] text-muted-foreground">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Single-series trend line (SVG) with optional dashed forecast tail and a
 *  dashed target rule. Values are pesewas or percents — fmt renders them. */
export function TrendLine({ points, color, fmt, target, forecast, yMax }: {
  points: { label: string; v: number | null }[];
  color: string; fmt: (v: number) => string;
  target?: { v: number; label: string };
  forecast?: { v: number; atLabel: string };
  yMax?: number;
}) {
  const W = 440, H = 150, L = 10, R = 10, T = 16, B = 20;
  const vals = points.map((p) => p.v).filter((v): v is number => v !== null);
  if (!vals.length) return <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>;
  const max = Math.max(yMax ?? 0, target?.v ?? 0, forecast?.v ?? 0, ...vals) || 1;
  const n = points.length;
  const denom = Math.max(1, (forecast ? n : n - 1));
  const x = (i: number) => L + (i / denom) * (W - L - R);
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const path = points
    .map((p, i) => (p.v === null ? null : `${x(i)},${y(p.v)}`))
    .filter(Boolean);
  const lastIdx = points.length - 1;
  const lastV = points[lastIdx]?.v ?? vals.at(-1)!;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img">
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={L} x2={W - R} y1={T + f * (H - T - B)} y2={T + f * (H - T - B)}
          className="stroke-border" strokeWidth="1" />
      ))}
      {target && (
        <>
          <line x1={L} x2={W - R} y1={y(target.v)} y2={y(target.v)}
            className="stroke-faint" strokeWidth="1.5" strokeDasharray="5 4" />
          <text x={W - R} y={y(target.v) - 5} textAnchor="end" fontSize="10"
            className="fill-muted-foreground">{target.label}</text>
        </>
      )}
      <polyline points={path.join(" ")} fill="none" stroke={color} strokeWidth="2"
        strokeLinejoin="round" strokeLinecap="round" />
      {forecast && (
        <line x1={x(lastIdx)} y1={y(lastV)} x2={W - R} y2={y(forecast.v)}
          stroke={color} strokeWidth="2" strokeDasharray="2 5" strokeLinecap="round" />
      )}
      <circle cx={x(lastIdx)} cy={y(lastV)} r="4" fill={color} />
      <text x={Math.min(x(lastIdx), W - 50)} y={y(lastV) - 8} fontSize="10.5" fontWeight="600"
        className="fill-foreground" textAnchor="middle">{fmt(lastV)}</text>
      {forecast && (
        <text x={W - R} y={y(forecast.v) - 6} fontSize="10" textAnchor="end"
          className="fill-muted-foreground">{forecast.atLabel}</text>
      )}
      <text x={L} y={H - 4} fontSize="10" className="fill-faint">{points[0]?.label}</text>
      <text x={x(lastIdx)} y={H - 4} fontSize="10" textAnchor="middle" className="fill-faint">
        {points[lastIdx]?.label}
      </text>
    </svg>
  );
}

/** Class × weekday heat grid; darker = worse. Values are percents. */
export function HeatGrid({ rows, cols, cells, color, links }: {
  rows: string[]; cols: string[]; cells: (number | null)[][];
  color: string; links?: string[];
}) {
  const max = Math.max(5, ...cells.flat().filter((v): v is number => v !== null));
  return (
    <div className="overflow-x-auto" data-nums="">
      <table className="w-full border-separate" style={{ borderSpacing: 3 }}>
        <thead>
          <tr>
            <th></th>
            {cols.map((c) => (
              <th key={c} className="pb-0.5 text-center text-[10.5px] font-medium text-muted-foreground">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r}>
              <td className="whitespace-nowrap pr-2 text-right text-[12px] text-muted-foreground">
                {links?.[i] ? <a href={links[i]} className="hover:text-primary">{r}</a> : r}
              </td>
              {cells[i].map((v, j) => (
                <td key={j} title={v === null ? "no data" : `${v}% absent`}
                  className="h-6 min-w-11 rounded-[4px] text-center text-[10.5px] font-semibold"
                  style={{
                    background: color,
                    opacity: v === null ? 0.06 : 0.12 + (v / max) * 0.88,
                    color: v !== null && v / max > 0.55 ? "#fff" : "transparent",
                  }}>
                  {v !== null ? `${v}%` : ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Proportional segment bar — channel mix, gender split. 2px gaps. */
export function SegBar({ parts }: {
  parts: { label: string; v: number; color: string; display: string }[];
}) {
  const total = parts.reduce((a, p) => a + p.v, 0) || 1;
  const shown = parts.filter((p) => p.v > 0);
  if (!shown.length) return <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>;
  return (
    <div data-nums="">
      <div className="flex h-6 gap-[2px] overflow-hidden rounded-[6px]">
        {shown.map((p) => (
          <span key={p.label} className="flex items-center overflow-hidden whitespace-nowrap pl-2 text-[11px] font-semibold text-white"
            style={{ width: `${(p.v / total) * 100}%`, background: p.color, minWidth: p.v ? 8 : 0 }}>
            {(p.v / total) >= 0.18 ? `${p.label} · ${p.display}` : ""}
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
        {shown.map((p) => (
          <span key={p.label} className="flex items-center gap-1.5">
            <i className="h-2.5 w-2.5 rounded-[3px]" style={{ background: p.color }} />
            {p.label} · <b className="text-foreground">{p.display}</b>
          </span>
        ))}
      </div>
    </div>
  );
}
