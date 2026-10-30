"use client";

import type { PlannedAttack } from "@optizzz/game/flood";
import { formatCompact, formatNumber } from "@optizzz/game/format/number-format";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "~/components/ui/chart";

/** A line's sample in the legend: plain for mine, dashed for the target's. */
function LegendLine({ color, dashed }: { color: string; dashed?: boolean }) {
  return (
    <svg width="24" height="6" aria-hidden="true" className="inline-block align-middle">
      <line
        x1="0"
        y1="3"
        x2="24"
        y2="3"
        stroke={color}
        strokeWidth="2.5"
        strokeDasharray={dashed ? "6 4" : undefined}
      />
    </svg>
  );
}

/**
 * Both TDC, before the first attack then after each one: mine in a plain amber line, the target's dashed in blue,
 * named in the legend under it (ADR 0003).
 */
export function FloodChart({ attacks, targetName }: { attacks: PlannedAttack[]; targetName: string }) {
  const first = attacks[0];
  if (!first) return null;
  const config: ChartConfig = {
    attacker: { label: "Mon TDC après", color: "var(--chart-1)" },
    target: { label: `TDC de ${targetName} après`, color: "var(--chart-2)" },
  };
  const data = [
    { step: "départ", attacker: first.attackerAfter - first.take, target: first.targetAfter + first.take },
    ...attacks.map((attack, index) => ({
      step: String(index + 1),
      attacker: attack.attackerAfter,
      target: attack.targetAfter,
    })),
  ];
  return (
    <>
      <ChartContainer config={config} className="aspect-auto h-44 w-full px-2 pt-3">
        <LineChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="step" tickLine={false} axisLine={false} minTickGap={8} className="font-mono" />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(value: number) => formatCompact(value)}
            className="font-mono"
          />
          <ChartTooltip content={<ChartTooltipContent formatter={(value) => `${formatNumber(Number(value))} cm²`} />} />
          <Line
            dataKey="attacker"
            type="linear"
            stroke="var(--color-attacker)"
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            dataKey="target"
            type="linear"
            stroke="var(--color-target)"
            strokeWidth={2.5}
            strokeDasharray="8 5"
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
      <p className="flex flex-wrap gap-x-4 gap-y-1 px-4 pb-3 text-xs">
        <span>
          <LegendLine color="var(--chart-1)" /> Mon TDC après
        </span>
        <span>
          <LegendLine color="var(--chart-2)" dashed /> Son TDC après
        </span>
      </p>
    </>
  );
}
