"use client";

// « Prise attendue par jour » of the Floods statistics (docs/features/site-envois.md, « Statistiques des floods »): the
// take the Plan de flood expected for the floods arrived each day (each hour over 24 hours), the number of floods
// written over each bar, so a flood launched without the Plan still shows.
import { formatCompact, formatNumber } from "@optizzz/game/format/number-format";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "~/components/ui/chart";
import type { Bucket } from "~/lib/envois/flood-stats";

const config: ChartConfig = { take: { label: "Prise attendue", color: "var(--chart-1)" } };

export function FloodStatsChart({ buckets }: { buckets: Bucket[] }) {
  if (buckets.every((b) => b.count === 0))
    return (
      <div className="flex min-h-40 items-center justify-center border border-dashed p-4 text-center text-muted-foreground">
        Aucun flood arrivé sur la période.
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
                const count = (item.payload as Bucket).count;
                return (
                  <div className="flex w-full flex-col gap-0.5">
                    <span className="flex gap-2">
                      <span className="text-muted-foreground">Prise attendue</span>
                      <span className="ml-auto font-mono text-foreground">{formatNumber(Number(value))}</span>
                    </span>
                    <span className="text-muted-foreground">
                      {formatNumber(count)} flood{count > 1 ? "s" : ""} arrivé{count > 1 ? "s" : ""}
                    </span>
                  </div>
                );
              }}
            />
          }
        />
        <Bar dataKey="take" fill="var(--color-take)" isAnimationActive={false}>
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
