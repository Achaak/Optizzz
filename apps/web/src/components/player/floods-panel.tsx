"use client";
// A player's probable floods over 30 days (docs/features/analyse-joueurs.md), lost and taken, filterable.
import { floodText, floodWhen, SURENESS_TITLES, type FloodLine } from "@optizzz/game/analysis/player-analysis";
import { formatNumber } from "@optizzz/game/format/number-format";
import { useState } from "react";
import { Panel } from "~/components/panel";
import { cn } from "cn";

const SURENESS = { sure: "sûr", combination: "combinaison", candidates: "candidats", unknown: "inconnu" } as const;

export function FloodsPanel({ floods, now }: { floods: FloodLine[]; now: string }) {
  const [shown, setShown] = useState<"all" | "lost" | "taken">("all");
  const lines = floods.filter((line) => shown === "all" || line.direction === shown);
  const filter = (value: typeof shown, label: string, count: number) => (
    <button
      type="button"
      aria-pressed={shown === value}
      onClick={() => setShown(value)}
      className={cn(
        "rounded-full px-3 py-1 text-sm",
        shown === value ? "bg-accent font-semibold" : "border border-border text-muted-foreground",
      )}
    >
      {label} ({formatNumber(count)})
    </button>
  );
  return (
    <Panel
      flush
      title="Floods probables sur 30 jours"
      aside={
        <div className="flex gap-1.5">
          {filter("all", "Tous", floods.length)}
          {filter("lost", "Perdus", floods.filter((line) => line.direction === "lost").length)}
          {filter("taken", "Pris", floods.filter((line) => line.direction === "taken").length)}
        </div>
      }
    >
      {lines.length === 0 ? (
        <p className="px-4.5 pb-4 text-sm text-muted-foreground">Aucun flood probable relevé.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th scope="col" className="px-4.5 py-2 text-left font-medium">
                  Quand
                </th>
                <th scope="col" className="px-2 py-2 text-left font-medium">
                  Sens
                </th>
                <th scope="col" className="px-2 py-2 text-right font-medium">
                  TDC
                </th>
                <th scope="col" className="px-2 py-2 text-left font-medium">
                  Avec qui
                </th>
                <th scope="col" className="px-4.5 py-2 text-left font-medium">
                  Sûreté
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={`${line.at}-${line.direction}-${String(line.amount)}`} className="border-t border-border">
                  <td className="px-4.5 py-2 whitespace-nowrap">{floodWhen(line, new Date(now))}</td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    <span aria-hidden>{line.direction === "lost" ? "▼ " : "▲ "}</span>
                    {line.direction === "lost" ? "perdu" : "pris"}
                  </td>
                  <td className="px-2 py-2 text-right font-semibold whitespace-nowrap tabular-nums">
                    {line.direction === "lost" ? "−" : "+"}
                    {formatNumber(line.amount)}
                  </td>
                  <td className="px-2 py-2">{floodText(line)}</td>
                  <td className="px-4.5 py-2 text-muted-foreground" title={SURENESS_TITLES[line.sureness]}>
                    {SURENESS[line.sureness]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="px-4.5 pt-2 pb-4 text-xs text-muted-foreground">
        Une baisse de plus de 1 % rapprochée des hausses des joueurs dont il était à portée, à 2 % près. Un gain mêlé de
        chasses ne correspond à rien : la perte reste alors sans coupable. Calculé d&apos;après l&apos;export public de
        Fourmizzz, relevé chaque heure.
      </p>
    </Panel>
  );
}
