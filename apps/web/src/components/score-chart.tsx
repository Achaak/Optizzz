"use client";

import { formatCompact, formatNumber } from "@optizzz/game/format/number-format";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { NotEnoughDays } from "~/components/stat";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "~/components/ui/chart";

export interface ScorePoint {
  /** « 21/10 ». */
  day: string;
  value: number;
}

/** Below this many days a curve says little: the day's figure instead (docs/features/site-refonte.md). */
export const MIN_CURVE_DAYS = 3;

const TONES = { amber: "var(--chart-1)", blue: "var(--chart-2)" };

/** One figure over the days, as the nightly exports give it. `unit` follows the day's figure (« joueurs »). */
export function ScoreChart({
  points,
  label,
  unit,
  tone = "amber",
  reversed,
}: {
  points: ScorePoint[];
  label: string;
  unit?: string;
  tone?: keyof typeof TONES;
  /** A rank: 1 at the top. */
  reversed?: boolean;
}) {
  const last = points.at(-1);
  if (points.length < MIN_CURVE_DAYS)
    return <NotEnoughDays value={last ? formatNumber(last.value) : "—"} caption={unit ?? label} day={last?.day} />;
  const config: ChartConfig = { value: { label, color: TONES[tone] } };
  const id = `fill-${tone}`;
  return (
    <ChartContainer config={config} className="aspect-auto h-56 w-full">
      <AreaChart data={points} margin={{ left: 4, right: 8, top: 8 }} accessibilityLayer>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="day" tickLine={false} axisLine={false} minTickGap={24} className="font-mono" />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={48}
          reversed={reversed}
          allowDecimals={false}
          tickFormatter={(value: number) => formatCompact(value)}
          domain={["auto", "auto"]}
          className="font-mono"
        />
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatNumber(Number(value))} />} />
        <Area
          dataKey="value"
          type="linear"
          stroke="var(--color-value)"
          strokeWidth={2.5}
          fill={reversed ? "none" : `url(#${id})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}
