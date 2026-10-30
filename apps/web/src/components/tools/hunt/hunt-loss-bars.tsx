"use client";

// « Pertes selon le TdC par chasse » in the report, as the mockup draws it: one bar per surface tried around the plan,
// the units lost written over each. Up to the advised surface the bars are plain, past it hatched: the pattern and the
// caption say it, not the colour alone (ADR 0003). See docs/features/site-chasse.md.
import { formatCompact, formatNumber } from "@optizzz/game/format/number-format";
import type { CurvePoint } from "@optizzz/game/hunt/extras";
import { formatLosses } from "@optizzz/game/hunt/texts";
import { cn } from "cn";

/** Few enough bars for their figures to stay readable in the report's width. */
const MAX_BARS = 8;

/** « 749 », « 1 914 », then « 14,9K »: short enough to sit over a narrow bar. */
const barValue = (value: number) => (value < 10_000 ? formatLosses(value) : formatCompact(value));

const HATCH = "repeating-linear-gradient(45deg, transparent 0 4px, rgb(0 0 0 / 0.3) 4px 6px)";

/** Every other surface when there are too many, the advised one always kept. */
function pick(curve: CurvePoint[], amount: number): CurvePoint[] {
  if (curve.length <= MAX_BARS) return curve;
  const step = Math.ceil(curve.length / MAX_BARS);
  return curve.filter((point, i) => i % step === 0 || point.amount === amount);
}

export function LossBars({ curve, amount }: { curve: CurvePoint[]; amount: number }) {
  const bars = pick(curve, amount);
  const max = Math.max(1, ...bars.map((bar) => bar.lostUnits));
  const described = bars.map((bar) => `${formatLosses(bar.lostUnits)} à ${formatNumber(bar.amount)} cm²`).join(", ");
  const columns = { gridTemplateColumns: `repeat(${String(bars.length)}, minmax(0, 1fr))` };
  return (
    <figure className="m-0 flex flex-col gap-1.5 border-b px-4 py-3.5">
      <figcaption className="font-heading text-lg uppercase">Pertes selon le TdC par chasse</figcaption>
      <div
        role="img"
        aria-label={`Unités perdues en moyenne, toutes chasses : ${described}. Surface conseillée : ${formatNumber(amount)} cm².`}
        className="grid items-end gap-1 border-b"
        style={columns}
      >
        {bars.map((bar) => {
          const past = bar.amount > amount;
          const chosen = bar.amount === amount;
          return (
            <div key={bar.amount} className="flex h-32 flex-col items-center justify-end gap-0.5">
              <span className={cn("max-w-full truncate font-mono text-[0.625rem]", chosen && "font-semibold")}>
                {barValue(bar.lostUnits)}
              </span>
              <div
                className={cn("w-full", past ? "bg-chart-2" : "bg-chart-1")}
                style={{
                  height: `${String(Math.max(2, (bar.lostUnits / max) * 85))}%`,
                  backgroundImage: past ? HATCH : undefined,
                }}
              />
            </div>
          );
        })}
      </div>
      <div aria-hidden className="grid gap-1 font-mono text-[0.625rem] text-muted-foreground" style={columns}>
        {bars.map((bar) => (
          <span
            key={bar.amount}
            className={cn("truncate text-center", bar.amount === amount && "font-semibold text-foreground")}
          >
            {formatCompact(bar.amount)}
            {bar.amount === amount && <span className="block leading-none">▲</span>}
          </span>
        ))}
      </div>
      <span className="text-xs text-muted-foreground">
        Unités perdues en moyenne, toutes chasses, si chaque chasse prenait cette surface. Plein : jusqu&apos;à la
        surface conseillée (▲ {formatNumber(amount)} cm²) ; hachuré : au-delà.
      </span>
    </figure>
  );
}
