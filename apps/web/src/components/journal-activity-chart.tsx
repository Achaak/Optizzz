"use client";

import { formatNumber } from "@optizzz/game/format/number-format";
import { useRouter } from "next/navigation";
import { useId } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { MIN_CURVE_DAYS } from "~/components/score-chart";
import { NotEnoughDays } from "~/components/stat";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "~/components/ui/chart";
import { JOURNAL_GROUPS, type JournalGroup } from "~/lib/server-stats";

/** One day of the chart; `href`, when given, is where a click on that day leads (the Journal of that day). */
export type JournalActivityPoint = { day: string; href?: string } & Record<JournalGroup, number>;

// Amber for the players, ink for the alliances, light amber for the colonies, blue and hatched for the diplomacy:
// apart under protanopia and deuteranopia, the hatching and the legend name them too (ADR 0003).
const COLORS: Record<JournalGroup, string> = {
  players: "var(--chart-1)",
  alliances: "var(--chart-5)",
  colonies: "var(--chart-3)",
  diplomacy: "var(--chart-2)",
};

const HATCHED: JournalGroup = "diplomacy";

const config: ChartConfig = Object.fromEntries(
  JOURNAL_GROUPS.map((group) => [group.id, { label: group.label, color: COLORS[group.id] }]),
);

/** The legend's square: the group's colour, hatched for the diplomacy as in the chart. */
function Swatch({ group }: { group: JournalGroup }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className="shrink-0">
      <rect width="10" height="10" fill={COLORS[group]} />
      {group === HATCHED && (
        <path d="M-1 3 3-1M-1 8 8-1M4 11 11 4" stroke="var(--card)" strokeOpacity={0.5} strokeWidth={1.5} />
      )}
    </svg>
  );
}

/** The Journal's Changes per day, stacked by group; a day with an `href` opens on a click. */
export function JournalActivityChart({ points }: { points: JournalActivityPoint[] }) {
  const router = useRouter();
  const hatch = `journal-hatch-${useId().replace(/:/g, "")}`;
  const last = points.at(-1);
  if (points.length < MIN_CURVE_DAYS) {
    const total = last ? JOURNAL_GROUPS.reduce((sum, group) => sum + last[group.id], 0) : 0;
    return <NotEnoughDays value={formatNumber(total)} caption="changements" day={last?.day} />;
  }
  const clickable = points.some((point) => point.href);
  return (
    <div className="space-y-3">
      <ChartContainer config={config} className={`aspect-auto h-64 w-full ${clickable ? "cursor-pointer" : ""}`}>
        <BarChart
          data={points}
          margin={{ left: 4, right: 8, top: 8 }}
          accessibilityLayer
          onClick={(state) => {
            const href = points[Number(state.activeIndex)]?.href;
            if (href) router.push(href);
          }}
        >
          <defs>
            <pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill={`var(--color-${HATCHED})`} />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--card)" strokeOpacity={0.5} strokeWidth="2" />
            </pattern>
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} minTickGap={16} className="font-mono" />
          <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} className="font-mono" />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name) => {
                  const group = JOURNAL_GROUPS.find((entry) => entry.id === name);
                  return (
                    <div className="flex w-full items-center gap-2">
                      {group && <Swatch group={group.id} />}
                      <span className="text-muted-foreground">{group?.label ?? name}</span>
                      <span className="ml-auto font-mono text-foreground">{formatNumber(Number(value))}</span>
                    </div>
                  );
                }}
              />
            }
          />
          {JOURNAL_GROUPS.map((group) => (
            <Bar
              key={group.id}
              dataKey={group.id}
              stackId="day"
              fill={group.id === HATCHED ? `url(#${hatch})` : `var(--color-${group.id})`}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ChartContainer>
      <ul aria-label="Légende" className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        {JOURNAL_GROUPS.map((group) => (
          <li key={group.id} className="flex items-center gap-1.5">
            <Swatch group={group.id} />
            {group.label}
            {group.id === HATCHED && " (hachurée)"}
          </li>
        ))}
      </ul>
    </div>
  );
}
