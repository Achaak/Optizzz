"use client";

import { formatCompact, formatNumber } from "@optizzz/game/format/number-format";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "~/components/ui/chart";

export interface CostPoint {
  level: number;
  /** What the levels cost added up, from the level held up to this one. */
  total: number;
}

/** What the levels cost added up, level after level, up to the one aimed at: one curve, named by its caption. */
export function CostsChart({ points, label }: { points: CostPoint[]; label: string }) {
  if (points.length < 2) return null;
  const config: ChartConfig = { total: { label, color: "var(--chart-1)" } };
  const top = Math.max(...points.map((point) => point.total));
  const ticks = [0, top / 2, top];
  // Wide enough for the longest tick on one line (mono digits, about 7 px each).
  const width = Math.max(...ticks.map((tick) => formatCompact(tick).length)) * 7 + 10;
  return (
    <ChartContainer config={config} className="aspect-auto h-44 w-full">
      <AreaChart data={points} margin={{ left: 4, right: 12, top: 8 }} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="level" tickLine={false} axisLine={false} minTickGap={12} className="font-mono" />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={width}
          domain={[0, top]}
          ticks={ticks}
          tickFormatter={(value: number) => formatCompact(value)}
          className="font-mono"
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const level: unknown = payload[0]?.payload;
                return level && typeof level === "object" && "level" in level ? `Niveau ${String(level.level)}` : "";
              }}
              formatter={(value) => formatNumber(Number(value))}
            />
          }
        />
        <Area
          dataKey="total"
          type="linear"
          stroke="var(--color-total)"
          strokeWidth={2.5}
          fill="var(--accent)"
          fillOpacity={1}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}
