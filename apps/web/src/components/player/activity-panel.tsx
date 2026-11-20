"use client";
// « Quand son TDC bouge »: the hourly moves of a player's field by Paris weekday and hour, over 4 weeks
// (docs/features/analyse-joueurs.md). One hue, darker with more hours; the count on hover and for screen readers.
import { quietHoursText, type PlayerAnalysis } from "@optizzz/game/analysis/player-analysis";
import { formatNumber } from "@optizzz/game/format/number-format";
import { useState } from "react";
import { Panel } from "~/components/panel";
import { cn } from "cn";

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const LONG_DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

/** The opacity of a cell: darker with more hours, the busiest cell full. */
const shade = (count: number, max: number) => (count === 0 ? 0 : 0.25 + (0.75 * count) / Math.max(max, 1));

export function ActivityPanel({ analysis }: { analysis: PlayerAnalysis }) {
  const [shown, setShown] = useState<"rises" | "falls">("rises");
  const grid = analysis.grid[shown];
  const max = Math.max(...grid.flat());
  const lead =
    shown === "rises"
      ? analysis.quietHours
        ? `Plage calme habituelle : ${quietHoursText(analysis.quietHours)}.`
        : "Pas de plage calme nette."
      : "Les baisses viennent des floods subis.";
  const tab = (value: typeof shown, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={shown === value}
      onClick={() => setShown(value)}
      className={cn(
        "h-8 rounded-full px-3.5 text-sm",
        shown === value ? "bg-card font-semibold text-foreground" : "text-muted-foreground",
      )}
    >
      {label}
    </button>
  );
  return (
    <Panel
      title="Quand son TDC bouge"
      aside={
        <div role="tablist" aria-label="Sens" className="flex gap-1 rounded-full bg-raised p-1">
          {tab("rises", "Hausses")}
          {tab("falls", "Baisses")}
        </div>
      }
    >
      <p className="text-sm">
        <strong>{lead}</strong>{" "}
        <span className="text-muted-foreground">
          {analysis.days >= 28
            ? "4 dernières semaines additionnées, heures de Paris."
            : `Seulement ${formatNumber(analysis.days)} ${analysis.days > 1 ? "jours relevés" : "jour relevé"}, heures de Paris.`}
        </span>
      </p>
      <div className="mt-3 overflow-x-auto">
        <div
          role="grid"
          aria-label={shown === "rises" ? "Hausses par jour et par heure" : "Baisses par jour et par heure"}
          className="grid min-w-[40rem] grid-cols-[2.75rem_repeat(24,minmax(1.25rem,1fr))] gap-[3px] text-xs"
        >
          <span />
          {Array.from({ length: 24 }, (_, hour) => (
            <span key={hour} className="text-center font-mono text-muted-foreground">
              {hour % 3 === 0 ? hour : ""}
            </span>
          ))}
          {grid.map((row, day) => [
            <span key={`day-${String(day)}`} className="self-center text-muted-foreground">
              {DAYS[day]}
            </span>,
            ...row.map((count, hour) => {
              const label = `${LONG_DAYS[day] ?? ""} ${String(hour)} h : ${formatNumber(count)} ${count > 1 ? "heures" : "heure"} ${shown === "rises" ? "en hausse" : "en baisse"}`;
              return (
                <span
                  key={`${String(day)}-${String(hour)}`}
                  role="gridcell"
                  title={label}
                  aria-label={label}
                  className="relative h-5 overflow-hidden rounded bg-raised"
                >
                  <span className="absolute inset-0 bg-primary" style={{ opacity: shade(count, max) }} />
                </span>
              );
            }),
          ])}
        </div>
      </div>
      <p className="mt-3 rounded-lg border border-warning-border bg-warning-soft px-3 py-2 text-sm">
        Un gain arrive au retour d&apos;une chasse ou d&apos;un flood, souvent des heures après le clic. Une baisse
        vient d&apos;un flood subi. Cette grille ne dit pas quand il est connecté.
      </p>
    </Panel>
  );
}
