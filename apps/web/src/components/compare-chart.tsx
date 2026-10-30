"use client";

import { formatCompact, formatNumber } from "@optizzz/game/format/number-format";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "~/components/ui/chart";

/** How the n-th compared one is drawn: its colour, and a mark and a dash so that colour is never needed (ADR 0003). */
export const COMPARE_STYLES = [
  { color: "var(--chart-1)", mark: "circle", dash: undefined },
  { color: "var(--chart-2)", mark: "square", dash: "8 4" },
  { color: "var(--chart-5)", mark: "triangle", dash: "2 4" },
  { color: "var(--chart-3)", mark: "diamond", dash: "12 4 2 4" },
  { color: "var(--chart-4)", mark: "cross", dash: "5 5" },
] as const;

type Mark = (typeof COMPARE_STYLES)[number]["mark"];

/** A mark centred on (x, y), in `color`. */
export function MarkShape({
  mark,
  x,
  y,
  color,
  size = 4,
}: {
  mark: Mark;
  x: number;
  y: number;
  color: string;
  size?: number;
}) {
  const s = size;
  switch (mark) {
    case "circle":
      return <circle cx={x} cy={y} r={s} fill={color} />;
    case "square":
      return <rect x={x - s} y={y - s} width={s * 2} height={s * 2} fill={color} />;
    case "triangle":
      return (
        <path
          d={`M${String(x)} ${String(y - s - 1)}L${String(x + s + 1)} ${String(y + s)}L${String(x - s - 1)} ${String(y + s)}Z`}
          fill={color}
        />
      );
    case "diamond":
      return (
        <path
          d={`M${String(x)} ${String(y - s - 1)}L${String(x + s + 1)} ${String(y)}L${String(x)} ${String(y + s + 1)}L${String(x - s - 1)} ${String(y)}Z`}
          fill={color}
        />
      );
    case "cross":
      return (
        <path
          d={`M${String(x - s)} ${String(y - s)}L${String(x + s)} ${String(y + s)}M${String(x + s)} ${String(y - s)}L${String(x - s)} ${String(y + s)}`}
          stroke={color}
          strokeWidth={2.5}
        />
      );
  }
}

/** The mark and the dash of the n-th compared one, for a legend or a table. */
export function CompareKey({ index }: { index: number }) {
  const style = COMPARE_STYLES[index % COMPARE_STYLES.length] ?? COMPARE_STYLES[0];
  return (
    <svg width="34" height="12" viewBox="0 0 34 12" aria-hidden className="inline-block shrink-0">
      <line x1="0" y1="6" x2="34" y2="6" stroke={style.color} strokeWidth={2.5} strokeDasharray={style.dash} />
      <MarkShape mark={style.mark} x={17} y={6} color={style.color} />
    </svg>
  );
}

export interface CompareRow {
  /** « 21/10 ». */
  day: string;
  values: (number | null)[];
}

/** The compared ones' curves of one figure, day by day; a rank with 1 at the top. */
export function CompareChart({ names, rows, reversed }: { names: string[]; rows: CompareRow[]; reversed: boolean }) {
  const config: ChartConfig = Object.fromEntries(
    names.map((name, index) => [`s${String(index)}`, { label: name, color: COMPARE_STYLES[index]?.color }]),
  );
  const data = rows.map((row) => ({
    day: row.day,
    ...Object.fromEntries(row.values.map((value, index) => [`s${String(index)}`, value])),
  }));
  // A mark on each day while they stay apart; past that, one every few days.
  const every = Math.max(1, Math.ceil(rows.length / 15));
  return (
    <ChartContainer config={config} className="aspect-auto h-80 w-full">
      <LineChart data={data} margin={{ left: 4, right: 12, top: 12, bottom: 4 }} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="day" tickLine={false} axisLine={false} minTickGap={24} className="font-mono" />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={48}
          reversed={reversed}
          allowDecimals={false}
          tickFormatter={(value: number) => formatCompact(value)}
          domain={reversed ? [1, "dataMax"] : ["auto", "auto"]}
          className="font-mono"
        />
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatNumber(Number(value))} />} />
        {names.map((name, index) => {
          const style = COMPARE_STYLES[index] ?? COMPARE_STYLES[0];
          return (
            <Line
              key={name}
              dataKey={`s${String(index)}`}
              name={name}
              type="linear"
              stroke={style.color}
              strokeWidth={2.5}
              strokeDasharray={style.dash}
              connectNulls
              isAnimationActive={false}
              dot={(props: { cx?: number; cy?: number; index?: number; value?: number | null }) => {
                const key = `${name}-${String(props.index)}`;
                if (props.cx === undefined || props.cy === undefined || props.value === null) return <g key={key} />;
                if ((props.index ?? 0) % every !== 0 && props.index !== rows.length - 1) return <g key={key} />;
                return (
                  <g key={key}>
                    <MarkShape mark={style.mark} x={props.cx} y={props.cy} color={style.color} />
                  </g>
                );
              }}
              activeDot={false}
            />
          );
        })}
      </LineChart>
    </ChartContainer>
  );
}
