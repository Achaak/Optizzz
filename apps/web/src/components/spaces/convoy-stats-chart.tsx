"use client";

// « Livré par jour » of the Convois statistics (docs/features/site-envois.md, « Statistiques des convois »): the
// alliance's delivered food and materials stacked by day (by week over 90 days), or a member's delivered and received
// side by side. Amber plain against blue hatched, the legend naming each (ADR 0003).
import { formatCompact, formatNumber } from "@optizzz/game/format/number-format";
import { useId } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "~/components/ui/chart";
import type { Bucket } from "~/lib/envois/convoy-stats";

/** Under this many days with a delivery, a note stands in for the chart. */
const MIN_DAYS = 3;

type Series = "materials" | "food" | "sent" | "received";

// Recharts stacks the first series at the bottom.
const ALLIANCE: readonly Series[] = ["food", "materials"];
const MEMBER: readonly Series[] = ["sent", "received"];

const config: ChartConfig = {
  materials: { label: "Matériaux", color: "var(--chart-1)" },
  food: { label: "Nourriture", color: "var(--chart-2)" },
  sent: { label: "Livré", color: "var(--chart-1)" },
  received: { label: "Reçu", color: "var(--chart-2)" },
};

/** Blue is hatched, amber plain. */
const hatched = (series: Series) => series === "food" || series === "received";

function Swatch({ series }: { series: Series }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className="shrink-0">
      <rect width="10" height="10" fill={config[series]?.color} />
      {hatched(series) && (
        <path d="M-1 3 3-1M-1 8 8-1M4 11 11 4" stroke="var(--card)" strokeOpacity={0.5} strokeWidth={1.5} />
      )}
    </svg>
  );
}

export function ConvoyStatsChart({ buckets, member }: { buckets: Bucket[]; member: boolean }) {
  const hatch = `convoy-hatch-${useId().replace(/:/g, "")}`;
  const series = member ? MEMBER : ALLIANCE;
  const days = buckets.filter((b) => series.some((s) => b[s] > 0)).length;
  if (days < MIN_DAYS) {
    const total = buckets.reduce((sum, b) => sum + series.reduce((s, key) => s + b[key], 0), 0);
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-1 border border-dashed p-4 text-center rounded-[0.625rem]">
        <span className="font-mono text-3xl">{formatCompact(total)}</span>
        <span>{member ? "livré et reçu" : "livré"} sur la période</span>
        <span className="text-xs text-muted-foreground">Graphique affiché à partir de 3 jours avec un convoi</span>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <ChartContainer config={config} className="aspect-auto h-64 w-full">
        <BarChart data={buckets} margin={{ left: 4, right: 8, top: 8 }} accessibilityLayer>
          <defs>
            <pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="var(--chart-2)" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--card)" strokeOpacity={0.5} strokeWidth="2" />
            </pattern>
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={16} className="font-mono" />
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
                formatter={(value, name) => {
                  const key = series.find((s) => s === name);
                  return (
                    <div className="flex w-full items-center gap-2">
                      {key && <Swatch series={key} />}
                      <span className="text-muted-foreground">{key ? config[key]?.label : name}</span>
                      <span className="ml-auto font-mono text-foreground">{formatNumber(Number(value))}</span>
                    </div>
                  );
                }}
              />
            }
          />
          {series.map((key) => (
            <Bar
              key={key}
              dataKey={key}
              stackId={member ? undefined : "day"}
              fill={hatched(key) ? `url(#${hatch})` : `var(--color-${key})`}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ChartContainer>
      <ul aria-label="Légende" className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        {series.map((key) => (
          <li key={key} className="flex items-center gap-1.5">
            <Swatch series={key} />
            {config[key]?.label}
            {member ? (key === "sent" ? " (à gauche, plein)" : " (à droite, hachuré)") : null}
            {!member && (key === "materials" ? " (en haut, plein)" : " (en bas, hachurée)")}
          </li>
        ))}
      </ul>
    </div>
  );
}
