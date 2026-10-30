import { formatNumber } from "@optizzz/game/format/number-format";
import Link from "next/link";

// Bar charts drawn in HTML on the server: a handful of bars needs no chart library, and they print, zoom and read
// aloud like the rest of the page. The figure is always written beside its bar (ADR 0003).

/** Vertical bars, one per bracket, the count over each. */
export function Histogram({ bars, label }: { bars: { label: string; value: number }[]; label: string }) {
  const max = Math.max(1, ...bars.map((bar) => bar.value));
  const described = bars.map((bar) => `${bar.label} : ${formatNumber(bar.value)}`).join(" ; ");
  return (
    <figure className="m-0 space-y-2">
      <div role="img" aria-label={`${label}. ${described}`} className="flex h-52 items-end gap-1.5 border-b sm:gap-2">
        {bars.map((bar) => (
          <div key={bar.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <span className="font-mono text-[0.625rem] whitespace-nowrap sm:text-xs">{formatNumber(bar.value)}</span>
            <div className="w-full bg-chart-1" style={{ height: `${String((bar.value / max) * 85)}%` }} />
          </div>
        ))}
      </div>
      <div aria-hidden className="flex gap-1.5 sm:gap-2">
        {bars.map((bar) => (
          <span key={bar.label} className="min-w-0 flex-1 text-center font-mono text-[0.625rem] text-muted-foreground">
            {bar.label}
          </span>
        ))}
      </div>
    </figure>
  );
}

export interface BarRow {
  key: string;
  label: string;
  href?: string;
  value: number;
  /** The value as written at the end of the bar: « 9,0 % », « 706 201 ». */
  text: string;
}

/** Horizontal bars, the value written at the end of each: read as text, links kept. Blue unless `tone="amber"`. */
export function ValueBars({ rows, tone = "blue" }: { rows: BarRow[]; tone?: "amber" | "blue" }) {
  const max = Math.max(Number.MIN_VALUE, ...rows.map((row) => row.value));
  return (
    <div className="grid grid-cols-[minmax(3.5rem,max-content)_minmax(0,1fr)_max-content] items-center gap-x-3 gap-y-2 text-sm">
      {rows.map((row) => (
        <div key={row.key} className="contents">
          {row.href ? (
            <Link href={row.href} className="truncate font-semibold hover:underline">
              {row.label}
            </Link>
          ) : (
            <span className="truncate font-semibold">{row.label}</span>
          )}
          <div
            aria-hidden
            className={`h-3.5 ${tone === "amber" ? "bg-chart-1" : "bg-chart-2"}`}
            style={{ width: `${String((row.value / max) * 100)}%` }}
          />
          <span className="text-right font-mono">{row.text}</span>
        </div>
      ))}
    </div>
  );
}
