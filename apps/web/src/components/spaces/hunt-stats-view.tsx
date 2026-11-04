"use client";

// The « Statistiques » view of the Chasses tab (docs/features/site-envois.md, « Chasses par membre »): figures, the
// field hunted by day (by hour over 24 hours), each member (or, with a member chosen, their own hunts) and the hunts
// coming back next. Worked out in this browser; the site sees none of it.
import type { HuntItem } from "@optizzz/game/site-links/envoi-hunts";
import { formatCompact, formatDecimal, formatNumber } from "@optizzz/game/format/number-format";
import { dayMonth, formatEndTime, formatPastTime } from "@optizzz/game/format/time-format";
import { cn } from "cn";
import { useState } from "react";
import { Stat, StatGrid } from "~/components/stat";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { listNames } from "~/lib/envois/convoy-stats";
import type { HuntMemberRow, HuntPeriod, HuntStats } from "~/lib/envois/hunt-stats";
import { HuntStatsChart } from "./hunt-stats-chart";
import { Callout, DeclaredTag, Panel } from "./parts";

export const huntsWord = (count: number) => `${formatNumber(count)} chasse${count > 1 ? "s" : ""}`;

const PERIOD_LABEL: Record<HuntPeriod, string> = { "24h": "24 heures", "7j": "7 jours", "30j": "30 jours" };

/** « 24 800 fourmis », or why they are unknown. */
export const antsText = (ants: number | null) =>
  ants === null ? "fourmis inconnues (sans Compte+)" : `${formatNumber(ants)} fourmis`;

type SortKey = "field" | "count" | "average" | "out" | "last";

const COLUMNS: readonly { key: SortKey; label: string; className?: string }[] = [
  { key: "count", label: "Chasses", className: "text-right" },
  { key: "field", label: "Terrain (cm²)" },
  { key: "average", label: "Moyenne", className: "hidden text-right sm:table-cell" },
  { key: "out", label: "En cours", className: "text-right" },
  { key: "last", label: "Dernière rentrée", className: "hidden sm:table-cell" },
];

export function HuntStatsView({
  stats,
  period,
  member,
  now,
}: {
  stats: HuntStats;
  period: HuntPeriod;
  member: string | null;
  now: Date;
}) {
  const { returned, out, coverage, perThousandAnts } = stats;
  return (
    <div className="space-y-5">
      {coverage.missing.length > 0 && (
        <Callout tone="warning">
          <strong>
            {formatNumber(coverage.senders)} membre{coverage.senders > 1 ? "s" : ""} sur{" "}
            {formatNumber(coverage.members)} {coverage.senders > 1 ? "envoient leurs" : "envoie ses"} chasses.
          </strong>{" "}
          {listNames(coverage.missing)} {coverage.missing.length > 1 ? "n'envoient" : "n'envoie"} pas
          «&nbsp;Chasses&nbsp;» : {coverage.missing.length > 1 ? "leurs" : "ses"} chasses n&apos;apparaissent nulle part
          ici.
        </Callout>
      )}
      <p className="text-muted-foreground">
        {stats.knownSince !== null &&
          `Chasses connues depuis le ${dayMonth(new Date(stats.knownSince))} : avant, il peut en manquer. `}
        Une chasse compte comme rentrée à son heure de retour.
      </p>

      <StatGrid label={`Chasses sur ${PERIOD_LABEL[period]}${member ? ` de ${member}` : ""}`}>
        <Stat
          label={`Chasses rentrées · ${PERIOD_LABEL[period]}`}
          value={formatNumber(returned.count)}
          hint={
            period === "24h" ? "sur les dernières 24 heures" : `${formatDecimal(returned.perDay)} par jour en moyenne`
          }
        />
        <Stat label="Terrain chassé" value={formatCompact(returned.field)} hint={`cm² sur ${PERIOD_LABEL[period]}`} />
        <Stat
          label="Moyenne par chasse"
          value={returned.average === null ? "—" : formatNumber(returned.average)}
          hint="cm² par chasse rentrée"
        />
        <Stat
          label="En cours"
          value={formatNumber(out.count)}
          tone={out.count > 0 ? "accent" : undefined}
          hint={
            out.next[0]
              ? `${formatNumber(out.field)} cm² attendus · prochain retour ${formatEndTime(new Date(out.next[0].returnsAt), now)}`
              : "aucune chasse en cours"
          }
        />
        <Stat
          label="cm² pour 1 000 fourmis"
          value={perThousandAnts === null ? "—" : formatNumber(perThousandAnts.value)}
          hint={
            perThousandAnts === null
              ? "fourmis connues seulement avec le Compte+"
              : `sur ${huntsWord(perThousandAnts.hunts)} dont on connaît les fourmis (Compte+)`
          }
        />
      </StatGrid>

      <Panel
        title={`Terrain chassé par ${period === "24h" ? "heure" : "jour"}`}
        aside="chasses rentrées, heure de Paris · nombre de chasses au-dessus de chaque barre"
      >
        <HuntStatsChart buckets={stats.buckets} />
      </Panel>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[999_1_40rem] flex-col gap-5">
          {member ? (
            <OwnPanel member={member} hunts={stats.own} now={now} />
          ) : (
            <MembersPanel rows={stats.rows} now={now} />
          )}
        </div>
        <div className="flex min-w-0 flex-[1_1_20rem] flex-col gap-5">
          <Panel title="En cours" aside={out.count > 3 ? "les 3 prochains retours" : undefined} flush>
            {out.next.length === 0 ? (
              <p className="px-4 py-3 text-muted-foreground">Aucune chasse en cours.</p>
            ) : (
              out.next.map((hunt, index) => (
                <div
                  key={`${hunt.hunter}@${String(hunt.returnsAt)}#${String(index)}`}
                  className={cn("grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-4 py-2", index > 0 && "border-t")}
                >
                  <strong>{hunt.hunter}</strong>
                  <span className="font-mono">{formatNumber(hunt.fieldGain)} cm²</span>
                  <span className="col-span-2 text-xs text-muted-foreground">
                    retour {formatEndTime(new Date(hunt.returnsAt), now)} · {antsText(hunt.ants)}
                  </span>
                </div>
              ))
            )}
          </Panel>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Chiffres calculés dans ce navigateur, avec la Clé d&apos;alliance : le site ne voit ni les retours, ni les cm².
        Le site garde une chasse 90 jours après son retour. Les fourmis envoyées ne sont connues qu&apos;avec le
        Compte+.
      </p>
    </div>
  );
}

/** « Ses chasses »: the chosen member's hunts out and back in the period, latest return first. */
function OwnPanel({ member, hunts, now }: { member: string; hunts: readonly HuntItem[]; now: Date }) {
  return (
    <Panel title={`Ses chasses · ${member}`} aside="en cours et rentrées sur la période" flush>
      {hunts.length === 0 ? (
        <p className="px-4 py-3 text-muted-foreground">Aucune chasse sur la période.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Retour</TableHead>
                <TableHead className="text-right">Terrain (cm²)</TableHead>
                <TableHead className="pr-4 text-right">Fourmis</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <HuntRows hunts={hunts} now={now} />
            </TableBody>
          </Table>
        </div>
      )}
    </Panel>
  );
}

/** One row per hunt: its return (« en cours » when still out), its cm², its ants. */
export function HuntRows({
  hunts,
  now,
  hunter = false,
}: {
  hunts: readonly (HuntItem & { declared?: true })[];
  now: Date;
  hunter?: boolean;
}) {
  return hunts.map((hunt, index) => {
    const away = hunt.returnsAt > now.getTime();
    return (
      <TableRow key={`${hunt.hunter}@${String(hunt.returnsAt)}#${String(index)}`}>
        {hunter && <TableCell className="pl-4 font-semibold">{hunt.hunter}</TableCell>}
        <TableCell className={cn("whitespace-nowrap", !hunter && "pl-4")}>
          {away ? (
            <>
              <span className="font-medium">en cours</span> · retour {formatEndTime(new Date(hunt.returnsAt), now)}
            </>
          ) : (
            `rentrée ${formatPastTime(new Date(hunt.returnsAt), now)}`
          )}
          {hunt.declared && <DeclaredTag />}
        </TableCell>
        <TableCell className="text-right font-mono">{formatNumber(hunt.fieldGain)}</TableCell>
        <TableCell className="pr-4 text-right font-mono">
          {hunt.ants === null ? (
            <span className="text-muted-foreground" title="Fourmis connues seulement avec le Compte+">
              —
            </span>
          ) : (
            formatNumber(hunt.ants)
          )}
        </TableCell>
      </TableRow>
    );
  });
}

function MembersPanel({ rows, now }: { rows: HuntMemberRow[]; now: Date }) {
  const [sort, setSort] = useState<SortKey>("field");
  const value = (row: HuntMemberRow) =>
    sort === "last" ? (row.last ?? 0) : sort === "average" ? (row.average ?? 0) : row[sort];
  const sending = rows.filter((row) => row.sends).sort((a, b) => value(b) - value(a));
  const silent = rows.filter((row) => !row.sends);
  const widest = Math.max(1, ...rows.map((row) => row.field));

  return (
    <Panel title="Par membre" aside="chasses rentrées sur la période · cliquez un en-tête pour trier" flush>
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
                      <div className="h-full bg-chart-1" style={{ width: `${String((100 * row.field) / widest)}%` }} />
                    </div>
                    <span className="min-w-16 text-right font-mono">{formatCompact(row.field)}</span>
                  </div>
                </TableCell>
                <TableCell className="hidden text-right font-mono sm:table-cell">
                  {row.average === null ? "—" : formatNumber(row.average)}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {row.out === 0 ? (
                    "—"
                  ) : (
                    <>
                      {formatNumber(row.out)}
                      <span className="text-muted-foreground"> · {formatCompact(row.outField)} cm²</span>
                    </>
                  )}
                </TableCell>
                <TableCell className="hidden whitespace-nowrap sm:table-cell">
                  {row.last === null ? "—" : formatPastTime(new Date(row.last), now)}
                </TableCell>
              </TableRow>
            ))}
            {silent.map((row) => (
              <TableRow key={row.player} className="text-muted-foreground">
                <TableCell className="pl-4 font-semibold">{row.player}</TableCell>
                <TableCell colSpan={COLUMNS.length}>n&apos;envoie pas «&nbsp;Chasses&nbsp;»</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Panel>
  );
}
