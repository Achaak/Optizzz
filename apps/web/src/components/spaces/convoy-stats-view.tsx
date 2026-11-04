"use client";

// The « Statistiques » view of the Convois tab (docs/features/site-envois.md, « Statistiques des convois »): figures,
// « Livré par jour », each member (or, with a member chosen, each player they exchanged with), the convoys on their
// way, the biggest flows and the convoys with other players. Worked out in this browser; the site sees none of it.
import { formatCompact, formatDecimal, formatNumber } from "@optizzz/game/format/number-format";
import { dayMonth, formatEndTime, formatPastTime } from "@optizzz/game/format/time-format";
import { cn } from "cn";
import { useState } from "react";
import { Stat, StatGrid } from "~/components/stat";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { DAYS_BY_DAY, listNames, type ConvoyStats, type OutsideWay, type PlayerRow } from "~/lib/envois/convoy-stats";
import { ConvoyStatsChart } from "./convoy-stats-chart";
import { Callout, Panel } from "./parts";

/** « +2,48M », « -6,72M », « 0 »: a Solde with its sign written. */
const signed = (value: number) => (value > 0 ? `+${formatCompact(value)}` : formatCompact(value));

const percent = (share: number) => `${formatNumber(Math.round(share * 100))} %`;

const convoysWord = (count: number) => `${formatNumber(count)} convoi${count > 1 ? "s" : ""}`;

type SortKey = "delivered" | "received" | "solde" | "count" | "last";

const COLUMNS: readonly { key: SortKey; label: string; className?: string }[] = [
  { key: "delivered", label: "Livré", className: "text-right" },
  { key: "received", label: "Reçu", className: "text-right" },
  { key: "solde", label: "Solde" },
  { key: "count", label: "Convois", className: "hidden text-right sm:table-cell" },
  { key: "last", label: "Dernier", className: "hidden sm:table-cell" },
];

export function ConvoyStatsView({
  stats,
  days,
  member,
  alliances,
  now,
}: {
  stats: ConvoyStats;
  /** How many days in the period. */
  days: number;
  member: string | null;
  /** Lower-case pseudo → alliance tag, from the server's public map; null until read. */
  alliances: Map<string, string | null> | null;
  now: Date;
}) {
  const sum = stats.delivered.food + stats.delivered.materials;
  const { coverage } = stats;
  return (
    <div className="space-y-5">
      {coverage.missing.length > 0 && (
        <Callout tone="warning">
          <strong>
            {formatNumber(coverage.senders)} membre{coverage.senders > 1 ? "s" : ""} sur{" "}
            {formatNumber(coverage.members)} {coverage.senders > 1 ? "envoient leurs" : "envoie ses"} convois.
          </strong>{" "}
          {listNames(coverage.missing)} {coverage.missing.length > 1 ? "n'envoient" : "n'envoie"} pas
          «&nbsp;Convois&nbsp;» : on ne compte que ce qu&apos;
          {coverage.missing.length > 1 ? "ils échangent" : "il échange"} avec ceux qui l&apos;envoient, pas{" "}
          {coverage.missing.length > 1 ? "leurs" : "ses"} convois avec d&apos;autres joueurs.
        </Callout>
      )}
      {stats.knownSince !== null && (
        <p className="text-muted-foreground">
          Convois connus depuis le {dayMonth(new Date(stats.knownSince))} : avant, il peut en manquer.
        </p>
      )}

      {stats.self ? (
        <StatGrid label={`Convois de ${stats.self.player} sur ${String(days)} jours`}>
          <Stat label={`Livré · ${String(days)} jours`} value={formatCompact(stats.self.delivered)} />
          <Stat label="Reçu" value={formatCompact(stats.self.received)} />
          <Stat label="Solde" value={signed(stats.self.solde)} hint="reçu − livré, comme la Priorité" />
          <Stat
            label="Convois"
            value={formatNumber(stats.self.count)}
            hint={`${formatDecimal(stats.self.count / days)} par jour en moyenne`}
          />
          <OnWayStat stats={stats} now={now} />
        </StatGrid>
      ) : (
        <StatGrid label={`Convois sur ${String(days)} jours`}>
          <Stat
            label={`Livré · ${String(days)} jours`}
            value={formatCompact(sum)}
            hint={`${formatCompact(stats.delivered.food)} nourriture · ${formatCompact(stats.delivered.materials)} matériaux`}
          />
          <Stat
            label="Convois livrés"
            value={formatNumber(stats.delivered.count)}
            hint={`${formatDecimal(stats.delivered.count / days)} par jour en moyenne`}
          />
          <OnWayStat stats={stats} now={now} />
          <Stat
            label="Entre membres"
            value={stats.betweenMembers === null ? "—" : percent(stats.betweenMembers)}
            hint="le reste vers ou depuis d'autres joueurs"
          />
          <Stat
            label="Pour les Demandes"
            value={stats.forDemandes.amount === 0 ? "0" : `≈ ${formatCompact(stats.forDemandes.amount)}`}
            hint={
              stats.forDemandes.demandes === 0
                ? "aucune Demande servie"
                : `environ, ${formatNumber(stats.forDemandes.demandes)} Demande${stats.forDemandes.demandes > 1 ? "s" : ""} servie${stats.forDemandes.demandes > 1 ? "s" : ""}`
            }
          />
        </StatGrid>
      )}

      <Panel
        title={`${member ? "Livré et reçu" : "Livré"} par ${days > DAYS_BY_DAY ? "semaine" : "jour"}`}
        aside="convois livrés, heure de Paris"
      >
        <ConvoyStatsChart buckets={stats.buckets} member={member !== null} />
      </Panel>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[999_1_40rem] flex-col gap-5">
          <PlayersPanel rows={stats.rows} member={member} alliances={alliances} now={now} />
        </div>
        <div className="flex min-w-0 flex-[1_1_20rem] flex-col gap-5">
          <OnWayPanel stats={stats} now={now} />
          <Panel title="Flux principaux" aside="entre deux membres" flush>
            {stats.flows.length === 0 ? (
              <p className="px-4 py-3 text-muted-foreground">Aucun convoi entre deux membres sur la période.</p>
            ) : (
              <ol>
                {stats.flows.map((flow, index) => (
                  <li
                    key={`${flow.from}>${flow.to}`}
                    className={cn(
                      "grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-4 py-2",
                      index > 0 && "border-t",
                    )}
                  >
                    <span>
                      <strong>{flow.from}</strong> <span className="text-muted-foreground">→</span>
                      <span className="sr-only"> vers </span> <strong>{flow.to}</strong>
                    </span>
                    <span className="font-mono">{formatCompact(flow.amount)}</span>
                    <div aria-hidden className="h-1.5 self-center bg-muted">
                      <div
                        className="h-full bg-muted-foreground"
                        style={{ width: `${String((100 * flow.amount) / (stats.flows[0]?.amount ?? 1))}%` }}
                      />
                    </div>
                    <span className="text-right text-xs text-muted-foreground">{convoysWord(flow.count)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
          <Panel title="Hors alliance" aside="un seul des deux est membre" flush>
            <OutsideLine label="Vers d'autres joueurs" way={stats.outside.sent} alliances={alliances} />
            <OutsideLine label="Depuis d'autres joueurs" way={stats.outside.received} alliances={alliances} border />
            <p className="border-t px-4 py-2 text-xs text-muted-foreground">
              D&apos;après les membres actuels de l&apos;Espace : un ancien membre compte ici.
            </p>
          </Panel>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Chiffres calculés dans ce navigateur, avec la Clé d&apos;alliance : le site ne voit ni les quantités, ni qui
        envoie à qui. Un convoi compte à sa livraison, une fois, qu&apos;il soit relevé par celui qui l&apos;envoie ou
        par celui qui le reçoit. Convois gardés 90 jours.
      </p>
    </div>
  );
}

function OnWayStat({ stats, now }: { stats: ConvoyStats; now: Date }) {
  const next = stats.onWay.next[0];
  return (
    <Stat
      label="En route"
      value={formatNumber(stats.onWay.count)}
      tone={stats.onWay.count > 0 ? "accent" : undefined}
      hint={
        next
          ? `${formatCompact(stats.onWay.food + stats.onWay.materials)} · le prochain ${formatEndTime(new Date(next.at), now)}`
          : "aucun convoi en route"
      }
    />
  );
}

function OnWayPanel({ stats, now }: { stats: ConvoyStats; now: Date }) {
  return (
    <Panel title="En route" aside={stats.onWay.count > 3 ? "les 3 prochains" : undefined} flush>
      {stats.onWay.next.length === 0 ? (
        <p className="px-4 py-3 text-muted-foreground">Aucun convoi en route.</p>
      ) : (
        stats.onWay.next.map((convoy, index) => (
          <div
            key={`${convoy.from}>${convoy.to}@${String(convoy.at)}#${String(index)}`}
            className={cn("grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-4 py-2", index > 0 && "border-t")}
          >
            <span>
              <strong>{convoy.from}</strong> <span className="text-muted-foreground">→</span>
              <span className="sr-only"> vers </span> <strong>{convoy.to}</strong>
            </span>
            <span className="font-mono">{formatCompact(convoy.food + convoy.materials)}</span>
            <span className="col-span-2 text-xs text-muted-foreground">
              arrivée {formatEndTime(new Date(convoy.at), now)}
            </span>
          </div>
        ))
      )}
    </Panel>
  );
}

function OutsideLine({
  label,
  way,
  alliances,
  border,
}: {
  label: string;
  way: OutsideWay;
  alliances: Map<string, string | null> | null;
  border?: boolean;
}) {
  const named = (player: string) => {
    const tag = alliances?.get(player.toLowerCase());
    return tag ? `${player} [${tag}]` : player;
  };
  const who = [
    ...way.top.map((entry) => `${named(entry.player)} (${formatCompact(entry.amount)})`),
    ...(way.others > 0 ? [`${formatNumber(way.others)} autre${way.others > 1 ? "s" : ""}`] : []),
  ].join(", ");
  return (
    <div className={cn("grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 px-4 py-2.5", border && "border-t")}>
      <span>{label}</span>
      <span className="font-mono">{formatCompact(way.total)}</span>
      <span className="col-span-2 text-xs text-muted-foreground">{who || "aucun convoi"}</span>
    </div>
  );
}

function PlayersPanel({
  rows,
  member,
  alliances,
  now,
}: {
  rows: PlayerRow[];
  member: string | null;
  alliances: Map<string, string | null> | null;
  now: Date;
}) {
  const [sort, setSort] = useState<SortKey>("delivered");
  const [showAll, setShowAll] = useState(false);
  const value = (row: PlayerRow) => (sort === "last" ? (row.last ?? 0) : row[sort]);
  const sorted = [...rows].sort((a, b) => value(b) - value(a));
  const idle = rows.filter((row) => row.count === 0).length;
  const shown = showAll ? sorted : sorted.filter((row) => row.count > 0);
  const widest = Math.max(1, ...rows.map((row) => Math.abs(row.solde)));

  return (
    <Panel
      title={member ? `Avec qui · ${member}` : "Par membre"}
      aside={member ? "livré à, reçu de" : "cliquez un en-tête pour trier"}
      flush
    >
      {shown.length === 0 ? (
        <p className="px-4 py-3 text-muted-foreground">Aucun convoi livré sur la période.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">{member ? "Joueur" : "Membre"}</TableHead>
                {COLUMNS.map((column) => (
                  <TableHead
                    key={column.key}
                    className={column.className}
                    aria-sort={sort === column.key ? "descending" : undefined}
                  >
                    <button
                      type="button"
                      onClick={() => setSort(column.key)}
                      className={cn(
                        "inline-flex items-center gap-1 hover:text-foreground",
                        sort === column.key ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {column.label}
                      {column.key === "solde" && <span className="normal-case tracking-normal">(reçu − livré)</span>}
                      {sort === column.key && <span aria-hidden>▼</span>}
                    </button>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((row) => {
                const tag = row.member ? null : alliances?.get(row.player.toLowerCase());
                const width = (50 * Math.abs(row.solde)) / widest;
                return (
                  <TableRow key={row.player}>
                    <TableCell className="pl-4 font-semibold">
                      {row.player}
                      {tag && <span className="font-normal text-muted-foreground"> [{tag}]</span>}
                      {member && !row.member && (
                        <span className="font-normal text-muted-foreground"> · hors alliance</span>
                      )}
                      {row.partial && (
                        <span
                          className="ml-1.5 font-mono text-xs font-normal text-muted-foreground"
                          title="N'envoie pas « Convois » : seulement ce qu'il échange avec ceux qui l'envoient"
                        >
                          partiel
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{formatCompact(row.delivered)}</TableCell>
                    <TableCell className="text-right">{formatCompact(row.received)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div aria-hidden className="relative h-2 min-w-20 flex-1 bg-muted">
                          <div className="absolute inset-y-[-3px] left-1/2 w-px bg-muted-foreground" />
                          <div
                            className={cn(
                              "absolute inset-y-0",
                              row.solde >= 0 ? "left-1/2 bg-chart-2" : "right-1/2 bg-chart-1",
                            )}
                            style={{ width: `${String(width)}%` }}
                          />
                        </div>
                        <span className="min-w-16 text-right font-mono">{signed(row.solde)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-right sm:table-cell">{formatNumber(row.count)}</TableCell>
                    <TableCell className="hidden whitespace-nowrap sm:table-cell">
                      {row.last === null ? "—" : formatPastTime(new Date(row.last), now)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t px-4 py-2.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-3 bg-chart-1" />à gauche, «&nbsp;-&nbsp;» : a plus livré que reçu
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-3 bg-chart-2" />à droite, «&nbsp;+&nbsp;» : a plus reçu que livré
        </span>
        {!member && idle > 0 && (
          <button
            type="button"
            onClick={() => setShowAll((all) => !all)}
            className="font-semibold text-primary hover:underline"
          >
            {showAll ? "Masquer les membres sans convoi" : `Afficher les membres sans convoi (${formatNumber(idle)})`}
          </button>
        )}
      </div>
    </Panel>
  );
}
