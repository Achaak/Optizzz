"use client";

// The « Statistiques » view of the Floods tab (docs/features/site-envois.md, « Statistiques des floods »): figures,
// the take expected by day (by hour over 24 hours), each member (or, with a member chosen, their targets), the targets
// hit most, the floods on their way and, for an Admin, the army sent. Worked out in this browser; the site sees none of
// it. The take is the Plan de flood's, never the combat's.
import { UNITS, unitLabel } from "@optizzz/game/army/units";
import { formatCompact, formatDecimal, formatNumber } from "@optizzz/game/format/number-format";
import { formatEndTime, formatPastTime } from "@optizzz/game/format/time-format";
import { cn } from "cn";
import { useState } from "react";
import { Stat, StatGrid } from "~/components/stat";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { listNames } from "~/lib/envois/convoy-stats";
import type { FloodPeriod, FloodStats, MemberRow, TargetRow } from "~/lib/envois/flood-stats";
import { FloodStatsChart } from "./flood-stats-chart";
import { Callout, Panel } from "./parts";

const floodsWord = (count: number) => `${formatNumber(count)} flood${count > 1 ? "s" : ""}`;

/** « ≥ 1,5M » when some floods have no take. */
const takeText = (take: number, withoutPlan: number) => `${withoutPlan > 0 ? "≥ " : ""}${formatCompact(take)}`;

const PERIOD_LABEL: Record<FloodPeriod, string> = { "24h": "24 heures", "7j": "7 jours" };

type SortKey = "take" | "count" | "targets" | "onWay" | "last";

const COLUMNS: readonly { key: SortKey; label: string; className?: string }[] = [
  { key: "count", label: "Floods", className: "text-right" },
  { key: "take", label: "Prise attendue" },
  { key: "targets", label: "Cibles", className: "hidden text-right sm:table-cell" },
  { key: "onWay", label: "En route", className: "text-right" },
  { key: "last", label: "Dernière arrivée", className: "hidden sm:table-cell" },
];

export function FloodStatsView({
  stats,
  period,
  member,
  isAdmin,
  alliances,
  now,
}: {
  stats: FloodStats;
  period: FloodPeriod;
  member: string | null;
  isAdmin: boolean;
  /** Lower-case pseudo → alliance tag, from the server's public map; null until read. */
  alliances: Map<string, string | null> | null;
  now: Date;
}) {
  const { arrived, coverage } = stats;
  const share = arrived.count === 0 ? null : (arrived.count - arrived.withoutPlan) / arrived.count;
  const perDay = period === "24h" ? null : arrived.count / 7;
  return (
    <div className="space-y-5">
      {coverage.missing.length > 0 && (
        <Callout tone="warning">
          <strong>
            {formatNumber(coverage.senders)} membre{coverage.senders > 1 ? "s" : ""} sur{" "}
            {formatNumber(coverage.members)} {coverage.senders > 1 ? "envoient leurs" : "envoie ses"} floods.
          </strong>{" "}
          {listNames(coverage.missing)} {coverage.missing.length > 1 ? "n'envoient" : "n'envoie"} pas
          «&nbsp;Floods&nbsp;» : {coverage.missing.length > 1 ? "leurs" : "ses"} attaques n&apos;apparaissent nulle part
          ici.
        </Callout>
      )}
      <p className="text-muted-foreground">
        Le site garde un flood 7 jours après son arrivée : les statistiques ne remontent pas plus loin. La prise est
        celle qu&apos;attendait le Plan de flood, pas celle du combat.
      </p>

      <StatGrid label={`Floods sur ${PERIOD_LABEL[period]}${member ? ` de ${member}` : ""}`}>
        <Stat
          label={`Floods arrivés · ${PERIOD_LABEL[period]}`}
          value={formatNumber(arrived.count)}
          hint={perDay === null ? "sur les dernières 24 heures" : `${formatDecimal(perDay)} par jour en moyenne`}
        />
        <Stat
          label="Prise attendue"
          value={takeText(arrived.take, arrived.withoutPlan)}
          hint={
            arrived.withoutPlan > 0
              ? `${floodsWord(arrived.withoutPlan)} lancé${arrived.withoutPlan > 1 ? "s" : ""} sans le Plan, prise inconnue`
              : "d'après le Plan de flood"
          }
        />
        <Stat
          label="En route"
          value={formatNumber(stats.onWay.count)}
          tone={stats.onWay.count > 0 ? "accent" : undefined}
          hint={
            stats.onWay.next[0]
              ? `le prochain ${formatEndTime(new Date(stats.onWay.next[0].at), now)}`
              : "aucun flood en route"
          }
        />
        <Stat
          label="Cibles"
          value={formatNumber(stats.targetCount.all)}
          hint={
            member
              ? `joueur${stats.targetCount.all > 1 ? "s" : ""} touché${stats.targetCount.all > 1 ? "s" : ""}`
              : `dont ${formatNumber(stats.targetCount.shared)} visée${stats.targetCount.shared > 1 ? "s" : ""} par plusieurs membres`
          }
        />
        <Stat
          label="Avec le Plan"
          value={share === null ? "—" : `${formatNumber(Math.round(share * 100))} %`}
          hint="des floods arrivés"
        />
      </StatGrid>

      <Panel
        title={`Prise attendue par ${period === "24h" ? "heure" : "jour"}`}
        aside="floods arrivés, heure de Paris · nombre de floods au-dessus de chaque barre"
      >
        <FloodStatsChart buckets={stats.buckets} />
      </Panel>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[999_1_40rem] flex-col gap-5">
          {member ? (
            <TargetsPanel title={`Ses cibles · ${member}`} targets={stats.targets} alliances={alliances} now={now} />
          ) : (
            <>
              <MembersPanel rows={stats.rows} now={now} />
              <TargetsPanel title="Cibles les plus visées" targets={stats.targets} alliances={alliances} now={now} />
            </>
          )}
        </div>
        <div className="flex min-w-0 flex-[1_1_20rem] flex-col gap-5">
          <Panel title="En route" aside={stats.onWay.count > 3 ? "les 3 prochains" : undefined} flush>
            {stats.onWay.next.length === 0 ? (
              <p className="px-4 py-3 text-muted-foreground">Aucun flood en route.</p>
            ) : (
              stats.onWay.next.map((flood, index) => (
                <div
                  key={`${flood.from}>${flood.target}@${String(flood.at)}#${String(index)}`}
                  className={cn("grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-4 py-2", index > 0 && "border-t")}
                >
                  <span>
                    <strong>{flood.from}</strong> <span className="text-muted-foreground">→</span>
                    <span className="sr-only"> sur </span> <strong>{flood.target}</strong>
                  </span>
                  <span
                    className="font-mono"
                    title={flood.take === null ? "Lancé sans le Plan : prise inconnue" : undefined}
                  >
                    {flood.take === null ? "—" : formatCompact(flood.take)}
                  </span>
                  <span className="col-span-2 text-xs text-muted-foreground">
                    arrivée {formatEndTime(new Date(flood.at), now)}
                  </span>
                </div>
              ))
            )}
          </Panel>
          {isAdmin && (
            <Panel
              title="Armée envoyée"
              aside={<span className="bg-muted px-1.5 font-mono text-[0.6875rem] text-muted-foreground">ADMINS</span>}
              flush
            >
              {stats.army === null ? (
                <p className="px-4 py-3 text-muted-foreground">
                  Aucune armée connue : seuls les floods du Plan la notent.
                </p>
              ) : (
                <>
                  <p className="px-4 py-2 text-xs text-muted-foreground">
                    sur {floodsWord(stats.army.floods)} lancé{stats.army.floods > 1 ? "s" : ""} avec le Plan
                  </p>
                  {UNITS.filter((unit) => (stats.army?.units[unit.key] ?? 0) > 0).map((unit) => (
                    <div key={unit.key} className="flex justify-between border-t px-4 py-1.5">
                      <span>{unitLabel(unit.key)}</span>
                      <span className="font-mono">{formatNumber(stats.army?.units[unit.key] ?? 0)}</span>
                    </div>
                  ))}
                </>
              )}
            </Panel>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Chiffres calculés dans ce navigateur, avec la Clé d&apos;alliance : le site ne voit ni les cibles, ni les
        prises. Seul celui qui lance un flood l&apos;envoie : un membre qui n&apos;envoie pas «&nbsp;Floods&nbsp;»
        n&apos;apparaît pas. Un flood annulé avant son arrivée disparaît.
      </p>
    </div>
  );
}

function TargetsPanel({
  title,
  targets,
  alliances,
  now,
}: {
  title: string;
  targets: TargetRow[];
  alliances: Map<string, string | null> | null;
  now: Date;
}) {
  return (
    <Panel title={title} aside="par prise attendue" flush>
      {targets.length === 0 ? (
        <p className="px-4 py-3 text-muted-foreground">Aucun flood arrivé sur la période.</p>
      ) : (
        <ol>
          {targets.map((target, index) => {
            const tag = alliances?.get(target.target.toLowerCase());
            return (
              <li
                key={target.target}
                className={cn(
                  "grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 px-4 py-2",
                  index > 0 && "border-t",
                )}
              >
                <span>
                  <strong>{target.target}</strong>
                  {tag && <span className="text-muted-foreground"> [{tag}]</span>}
                  {target.by.length > 1 && (
                    <span className="ml-1.5 bg-chart-2/15 px-1.5 font-mono text-[0.6875rem] text-chart-2">
                      {formatNumber(target.by.length)} membres
                    </span>
                  )}
                </span>
                <span className="font-mono">{takeText(target.take, target.withoutPlan)}</span>
                <span className="col-span-2 text-xs text-muted-foreground">
                  {floodsWord(target.count)} · {target.by.join(", ")} · dernier{" "}
                  {formatPastTime(new Date(target.last), now)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

function MembersPanel({ rows, now }: { rows: MemberRow[]; now: Date }) {
  const [sort, setSort] = useState<SortKey>("take");
  const value = (row: MemberRow) => (sort === "last" ? (row.last ?? 0) : row[sort]);
  const sending = rows.filter((row) => row.sends).sort((a, b) => value(b) - value(a));
  const silent = rows.filter((row) => !row.sends);
  const widest = Math.max(1, ...rows.map((row) => row.take));

  return (
    <Panel title="Par membre" aside="floods arrivés sur la période · cliquez un en-tête pour trier" flush>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Membre</TableHead>
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
                    {sort === column.key && <span aria-hidden>▼</span>}
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sending.map((row) => (
              <TableRow key={row.player}>
                <TableCell className="pl-4 font-semibold">{row.player}</TableCell>
                <TableCell className="text-right">{formatNumber(row.count)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div aria-hidden className="h-2 min-w-20 flex-1 bg-muted">
                      <div className="h-full bg-chart-1" style={{ width: `${String((100 * row.take) / widest)}%` }} />
                    </div>
                    <span className="min-w-16 text-right font-mono">{takeText(row.take, row.withoutPlan)}</span>
                  </div>
                </TableCell>
                <TableCell className="hidden text-right sm:table-cell">{formatNumber(row.targets)}</TableCell>
                <TableCell className="text-right">{row.onWay === 0 ? "—" : formatNumber(row.onWay)}</TableCell>
                <TableCell className="hidden whitespace-nowrap sm:table-cell">
                  {row.last === null ? "—" : formatPastTime(new Date(row.last), now)}
                </TableCell>
              </TableRow>
            ))}
            {silent.map((row) => (
              <TableRow key={row.player} className="text-muted-foreground">
                <TableCell className="pl-4 font-semibold">{row.player}</TableCell>
                <TableCell colSpan={COLUMNS.length}>n&apos;envoie pas «&nbsp;Floods&nbsp;»</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Panel>
  );
}
