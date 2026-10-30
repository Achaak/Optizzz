"use client";

import type { PlannedAttack } from "@optizzz/game/flood";
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

/**
 * Both TDC, before the first attack then after each one: mine in a plain amber line, the target's dashed in blue,
 * named in the legend (ADR 0003).
 */
export function FloodChart({ attacks, targetName }: { attacks: PlannedAttack[]; targetName: string }) {
  const first = attacks[0];
  if (!first) return null;
  const config: ChartConfig = {
    attacker: { label: "Votre TDC", color: "var(--chart-1)" },
    target: { label: `TDC de ${targetName}`, color: "var(--chart-2)" },
  };
  const data = [
    { step: "Départ", attacker: first.attackerAfter - first.take, target: first.targetAfter + first.take },
    ...attacks.map((attack, index) => ({
      step: `Att. ${String(index + 1)}`,
      attacker: attack.attackerAfter,
      target: attack.targetAfter,
    })),
  ];
  return (
    <ChartContainer config={config} className="aspect-auto h-56 w-full">
      <LineChart data={data} margin={{ left: 4, right: 12, top: 8 }} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="step" tickLine={false} axisLine={false} minTickGap={8} className="font-mono" />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(value: number) => formatCompact(value)}
          className="font-mono"
        />
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => `${formatNumber(Number(value))} cm²`} />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Line
          dataKey="attacker"
          type="linear"
          stroke="var(--color-attacker)"
          strokeWidth={2.5}
          dot={{ r: 3 }}
          isAnimationActive={false}
        />
        <Line
          dataKey="target"
          type="linear"
          stroke="var(--color-target)"
          strokeWidth={2.5}
          strokeDasharray="6 4"
          dot={{ r: 3 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
