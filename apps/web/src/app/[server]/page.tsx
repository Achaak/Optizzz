import { formatDecimal, formatNumber } from "@optizzz/game/format/number-format";
import { dayMonth, formatDateTime } from "@optizzz/game/format/time-format";
import type { Metadata } from "next";
import Link from "next/link";
import { AdSlot } from "~/components/ad-slot";
import { Histogram, ValueBars } from "~/components/bars";
import { JournalActivityChart } from "~/components/journal-activity-chart";
import { AllianceCrest } from "~/components/alliance-crest";
import { JournalList } from "~/components/journal-list";
import { MapSketch } from "~/components/map-sketch";
import { PageHeader, Panel, PanelLink } from "~/components/panel";
import { RankMark } from "~/components/rank-mark";
import { MIN_CURVE_DAYS, ScoreChart } from "~/components/score-chart";
import { ReadingNote, Stat, StatGrid } from "~/components/stat";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { serverOfPath } from "~/lib/game-server";
import { percentOf } from "~/lib/server-stats";
import { lastReading, mapSketch, serverSummary } from "~/server/queries";

export const revalidate = 3600;

interface Props {
  params: Promise<{ server: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const server = serverOfPath((await params).server);
  return {
    title: `Serveur ${server.name}`,
    description: `Joueurs, alliances, classement et derniers changements du serveur ${server.name} de Fourmizzz.`,
  };
}

/** « ▲ 17 depuis le 19/10 », against the day a week before the last one: the arrow's shape tells the way. */
function weekDelta(days: { day: Date; players: number }[]): string | undefined {
  const last = days.at(-1);
  const before = days.at(-8);
  if (!last || !before) return undefined;
  const delta = last.players - before.players;
  const since = `depuis le ${dayMonth(before.day)}`;
  if (delta === 0) return `Stable ${since}`;
  return `${delta > 0 ? "▲" : "▼"} ${formatNumber(Math.abs(delta))} ${since}`;
}

/** « 103,4 M » on a young server, « 25,9 T » on S1: the server's TDC short enough for its tile, as K/M/G write it. */
function shortField(field: number): string {
  const unit = [
    { size: 1e12, suffix: "T" },
    { size: 1e9, suffix: "G" },
  ].find(({ size }) => field >= size) ?? { size: 1e6, suffix: "M" };
  return `${formatDecimal(field / unit.size)} ${unit.suffix}`;
}

/** « 02/10 → 26/10 »: the days a curve covers. */
function dayRange(days: { day: Date }[]): string | undefined {
  const first = days.at(0);
  const last = days.at(-1);
  if (!first || !last) return undefined;
  return `${dayMonth(first.day)} → ${dayMonth(last.day)}`;
}

export default async function ServerPage({ params }: Props) {
  const server = serverOfPath((await params).server);
  const [reading, summary, nests] = await Promise.all([
    lastReading(server.id),
    serverSummary(server.id),
    mapSketch(server.id),
  ]);
  if (!reading)
    return (
      <div className="space-y-6">
        <PageHeader title={`Serveur ${server.name}`} />
        <ReadingNote text="Ce serveur n'a pas encore été relu par le site : revenez dans une heure." />
      </div>
    );

  const topShare = summary.topAlliances.reduce((sum, alliance) => sum + alliance.totalField, 0);
  const journalCurve = summary.journalDays.length >= MIN_CURVE_DAYS;
  const allianceHref = (tag: string) => `/${server.id}/alliances/${encodeURIComponent(tag)}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-stretch gap-6">
        <div className="flex min-w-0 flex-[999_1_32rem] items-end">
          <PageHeader
            title={`Serveur ${server.name}`}
            live={`Export du ${formatDateTime(reading)} · relu chaque heure`}
          />
        </div>
        <Link
          href={`/${server.id}/map`}
          className="lift relative min-h-56 min-w-0 flex-[1_1_22rem] overflow-hidden rounded-[0.875rem] bg-card shadow-panel"
        >
          <MapSketch nests={nests} className="absolute inset-0 size-full" />
          <span className="absolute top-3.5 right-3.5 flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-xs text-muted-foreground">
            <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
            les 10 premiers
          </span>
          <span className="absolute bottom-3.5 left-3.5 flex items-center gap-2 rounded-full bg-card px-3.5 py-2 font-semibold shadow-panel">
            Ouvrir la carte <span aria-hidden="true">→</span>
          </span>
        </Link>
      </div>

      <StatGrid label="Chiffres du serveur">
        <Stat label="Joueurs" value={formatNumber(summary.players)} hint={weekDelta(summary.playersPerDay)} />
        <Stat label="Alliances" value={formatNumber(summary.alliances)} />
        <Stat
          label="Colonisés"
          value={formatNumber(summary.colonized)}
          hint={`${String(Math.round(percentOf(summary.colonized, summary.players)))} % des joueurs`}
        />
        <Stat label="En vacances" value={formatNumber(summary.onHoliday)} />
        <Stat label="Bannis" value={formatNumber(summary.banned)} />
        <Stat label="TDC total" value={shortField(summary.field)} hint={`${formatNumber(summary.field)} cm²`} />
      </StatGrid>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Joueurs inscrits"
          aside={<span className="text-xs text-muted-foreground">{dayRange(summary.playersPerDay)}</span>}
        >
          <ScoreChart
            label="Joueurs"
            unit="joueurs"
            points={summary.playersPerDay.map((row) => ({ day: dayMonth(row.day), value: row.players }))}
          />
        </Panel>
        <Panel
          title="TDC total du serveur"
          aside={<span className="text-xs text-muted-foreground">relevé de minuit</span>}
        >
          <ScoreChart
            label="TDC (cm²)"
            unit="cm² de TDC"
            tone="blue"
            points={summary.playersPerDay.map((row) => ({ day: dayMonth(row.day), value: Math.round(row.field) }))}
          />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Répartition du TDC"
          aside={<span className="text-xs text-muted-foreground">joueurs par tranche (cm²)</span>}
        >
          <Histogram
            label="Nombre de joueurs par tranche de TDC"
            bars={summary.brackets.map((bracket) => ({ label: bracket.label, value: bracket.players }))}
          />
        </Panel>
        <Panel
          title={`Part du TDC · top ${String(summary.topAlliances.length)} alliances`}
          aside={
            <span className="font-mono text-xs text-primary">
              {String(Math.round(percentOf(topShare, summary.field)))} % au total
            </span>
          }
        >
          <ValueBars
            rows={summary.topAlliances.map((alliance) => {
              const share = percentOf(alliance.totalField, summary.field);
              return {
                key: alliance.tag,
                label: alliance.tag,
                href: allianceHref(alliance.tag),
                value: share,
                text: `${formatDecimal(share)} %`,
              };
            })}
          />
        </Panel>
      </div>

      <AdSlot />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          flush
          title="Premiers joueurs"
          aside={<PanelLink href={`/${server.id}/players`}>Tous les joueurs</PanelLink>}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 pl-4">#</TableHead>
                <TableHead>Joueur</TableHead>
                <TableHead>Alliance</TableHead>
                <TableHead className="pr-4 text-right">TDC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.topPlayers.map((player, index) => (
                <TableRow key={player.id}>
                  <TableCell className="pl-4">
                    <RankMark rank={index + 1} />
                  </TableCell>
                  <TableCell>
                    <Link href={`/${server.id}/players/${String(player.id)}`} className="font-semibold hover:underline">
                      {player.pseudo}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {player.alliance ? (
                      <Link
                        href={allianceHref(player.alliance)}
                        className="inline-flex items-center gap-1.5 hover:underline"
                      >
                        <AllianceCrest tag={player.alliance} size="xs" />
                        {player.alliance}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-4 text-right">{formatNumber(player.field)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
        <Panel
          flush
          title="Premières alliances"
          aside={<PanelLink href={`/${server.id}/alliances`}>Toutes les alliances</PanelLink>}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 pl-4">#</TableHead>
                <TableHead>Alliance</TableHead>
                <TableHead className="text-right">Membres</TableHead>
                <TableHead className="pr-4 text-right">TDC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.topAlliances.map((alliance, index) => (
                <TableRow key={alliance.tag}>
                  <TableCell className="pl-4">
                    <RankMark rank={index + 1} />
                  </TableCell>
                  <TableCell className="max-w-56 truncate">
                    <Link href={allianceHref(alliance.tag)} className="hover:underline">
                      <AllianceCrest tag={alliance.tag} /> <strong>{alliance.tag}</strong>{" "}
                      <span className="text-muted-foreground">{alliance.name.trim()}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">{formatNumber(alliance.playersCount)}</TableCell>
                  <TableCell className="pr-4 text-right">{formatNumber(alliance.totalField)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Activité du Journal"
          aside={journalCurve && <span className="text-xs text-muted-foreground">30 derniers jours</span>}
          // Too few days: the day's figure fills the panel, as tall as the list beside it.
          className={
            journalCurve ? undefined : "flex flex-col *:last:flex *:last:flex-1 *:last:flex-col *:last:*:flex-1"
          }
        >
          <JournalActivityChart
            points={summary.journalDays.map(({ day, ...groups }) => ({ day: dayMonth(day), ...groups }))}
          />
        </Panel>
        <Panel
          flush
          title="Derniers changements"
          aside={<PanelLink href={`/${server.id}/journal`}>Tout le Journal</PanelLink>}
        >
          <JournalList server={server.id} lines={summary.journal.slice(0, 10)} named />
        </Panel>
      </div>
    </div>
  );
}
