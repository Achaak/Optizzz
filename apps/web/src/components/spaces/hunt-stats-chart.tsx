"use client";

// « Terrain chassé par jour » of the Chasses statistics (docs/features/site-envois.md, « Chasses par membre »): the cm²
// of the hunts back each day (each hour over 24 hours), the number of hunts written over each bar.
import { formatCompact, formatNumber } from "@optizzz/game/format/number-format";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "~/components/ui/chart";
import type { HuntBucket } from "~/lib/envois/hunt-stats";

const config: ChartConfig = { field: { label: "Terrain chassé", color: "var(--chart-1)" } };

export function HuntStatsChart({ buckets }: { buckets: HuntBucket[] }) {
  if (buckets.every((b) => b.count === 0))
    return (
      <div className="flex min-h-40 items-center justify-center border border-dashed p-4 text-center text-muted-foreground rounded-[0.625rem]">
        Aucune chasse rentrée sur la période.
      </div>
    );
  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <BarChart data={buckets} margin={{ left: 4, right: 8, top: 24 }} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={12} className="font-mono" />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={(value: number) => formatCompact(value)}
          className="font-mono"
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, _name, item) => {
                const count = (item.payload as HuntBucket).count;
                return (
                  <div className="flex w-full flex-col gap-0.5">
                    <span className="flex gap-2">
                      <span className="text-muted-foreground">Terrain chassé</span>
                      <span className="ml-auto font-mono text-foreground">{formatNumber(Number(value))} cm²</span>
                    </span>
                    <span className="text-muted-foreground">
                      {formatNumber(count)} chasse{count > 1 ? "s" : ""} rentrée{count > 1 ? "s" : ""}
                    </span>
                  </div>
                );
              }}
            />
          }
        />
        <Bar dataKey="field" fill="var(--color-field)" isAnimationActive={false}>
          <LabelList
            dataKey="count"
            position="top"
            className="fill-foreground font-mono text-[0.6875rem]"
            formatter={(count: unknown) => (Number(count) > 0 ? formatNumber(Number(count)) : "")}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
