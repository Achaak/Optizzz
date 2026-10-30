"use client";

import { formatNumber } from "@optizzz/game/format/number-format";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { MIN_CURVE_DAYS } from "~/components/score-chart";
import { NotEnoughDays } from "~/components/stat";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "~/components/ui/chart";
import { JOURNAL_GROUPS, type JournalGroup } from "~/lib/server-stats";

export type JournalActivityPoint = { day: string } & Record<JournalGroup, number>;

// Amber and blue, each in two lightnesses: the groups stay apart under protanopia and deuteranopia, and the legend
// names them (ADR 0003).
const COLORS: Record<JournalGroup, string> = {
  players: "var(--chart-1)",
  alliances: "var(--chart-2)",
  colonies: "var(--chart-3)",
  diplomacy: "var(--chart-4)",
};

const config: ChartConfig = Object.fromEntries(
  JOURNAL_GROUPS.map((group) => [group.id, { label: group.label, color: COLORS[group.id] }]),
);

/** The Journal's Changes per day, stacked by group. */
export function JournalActivityChart({ points }: { points: JournalActivityPoint[] }) {
  const last = points.at(-1);
  if (points.length < MIN_CURVE_DAYS) {
    const total = last ? JOURNAL_GROUPS.reduce((sum, group) => sum + last[group.id], 0) : 0;
    return <NotEnoughDays value={formatNumber(total)} caption="changements" day={last?.day} />;
  }
  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <BarChart data={points} margin={{ left: 4, right: 8, top: 8 }} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="day" tickLine={false} axisLine={false} minTickGap={16} className="font-mono" />
        <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} className="font-mono" />
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatNumber(Number(value))} />} />
        <ChartLegend content={<ChartLegendContent />} />
        {JOURNAL_GROUPS.map((group) => (
          <Bar
            key={group.id}
            dataKey={group.id}
            stackId="day"
            fill={`var(--color-${group.id})`}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}
