"use client";

import { formatCompact, formatNumber } from "@optizzz/game/format/number-format";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "~/components/ui/chart";

export interface ScorePoint {
  /** « 21/10 ». */
  day: string;
  value: number;
}

/** One score over the days, as the nightly exports give it. */
export function ScoreChart({ points, label }: { points: ScorePoint[]; label: string }) {
  if (points.length < 2)
    return <p className="text-sm text-muted-foreground">Pas encore assez de jours pour tracer une courbe.</p>;
  const config: ChartConfig = { value: { label, color: "var(--chart-1)" } };
  return (
    <ChartContainer config={config} className="aspect-auto h-56 w-full">
      <LineChart data={points} margin={{ left: 8, right: 8 }} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="day" tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={(value: number) => formatCompact(value)}
          domain={["auto", "auto"]}
        />
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatNumber(Number(value))} />} />
        <Line dataKey="value" type="linear" stroke="var(--color-value)" strokeWidth={2} dot={false} />
      </LineChart>
    </ChartContainer>
  );
}
