"use client";

import { formatCompact, formatNumber } from "@optizzz/game/format/number-format";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "~/components/ui/chart";
import type { DevelopmentPlan, Resource } from "./development";

// One curve per resource, told apart by their stroke too (plain, dashed, dotted) and named in the legend (ADR 0003).
const STYLES: Record<Resource, { color: string; dash?: string }> = {
  food: { color: "var(--chart-1)" },
  materials: { color: "var(--chart-2)", dash: "6 4" },
  workers: { color: "var(--chart-5)", dash: "2 3" },
};

/** What the levels cost added up, level after level, up to the one aimed at. */
export function CostsChart({
  plan,
  resources,
  labels,
}: {
  plan: DevelopmentPlan;
  resources: Resource[];
  labels: Record<Resource, string>;
}) {
  if (plan.rows.length < 2) return null;
  const config: ChartConfig = Object.fromEntries(
    resources.map((resource) => [resource, { label: labels[resource], color: STYLES[resource].color }]),
  );
  const data = plan.rows.map((row) => ({ level: `Niv. ${String(row.level)}`, ...row.totalCost }));
  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <LineChart data={data} margin={{ left: 4, right: 12, top: 8 }} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="level" tickLine={false} axisLine={false} minTickGap={16} className="font-mono" />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(value: number) => formatCompact(value)}
          className="font-mono"
        />
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatNumber(Number(value))} />} />
        <ChartLegend content={<ChartLegendContent />} />
        {resources.map((resource) => (
          <Line
            key={resource}
            dataKey={resource}
            type="linear"
            stroke={`var(--color-${resource})`}
            strokeWidth={2.5}
            strokeDasharray={STYLES[resource].dash}
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}
