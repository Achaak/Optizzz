import { formatDecimal, formatNumber } from "@optizzz/game/format/number-format";
import { dayMonth, formatDateTime } from "@optizzz/game/format/time-format";
import type { Metadata } from "next";
import Link from "next/link";
import { AdSlot } from "~/components/ad-slot";
import { Histogram, ValueBars } from "~/components/bars";
import { JournalActivityChart } from "~/components/journal-activity-chart";
import { JournalList } from "~/components/journal-list";
import { PageHeader, Panel, PanelLink } from "~/components/panel";
import { ScoreChart } from "~/components/score-chart";
import { ReadingNote, Stat, StatGrid } from "~/components/stat";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { serverOfPath } from "~/lib/game-server";
import { percentOf } from "~/lib/server-stats";
import { lastReading, serverSummary } from "~/server/queries";

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

/** « +17 depuis le 19/10 », against the day a week before the last one. */
function weekDelta(days: { day: Date; players: number }[]): string | undefined {
  const last = days.at(-1);
  const before = days.at(-8);
  if (!last || !before) return undefined;
  const delta = last.players - before.players;
  return `${delta >= 0 ? "+" : "−"}${formatNumber(Math.abs(delta))} depuis le ${dayMonth(before.day)}`;
}

export default async function ServerPage({ params }: Props) {
  const server = serverOfPath((await params).server);
  const [reading, summary] = await Promise.all([lastReading(server.id), serverSummary(server.id)]);
  if (!reading)
    return (
      <div className="space-y-6">
        <PageHeader title={`Serveur ${server.name}`} />
        <ReadingNote text="Ce serveur n'a pas encore été relu par le site : revenez dans une heure." />
      </div>
    );

  const topShare = summary.topAlliances.reduce((sum, alliance) => sum + alliance.totalField, 0);
  const allianceHref = (tag: string) => `/${server.id}/alliances/${encodeURIComponent(tag)}`;

  return (
    <div className="space-y-6">
      <PageHeader title={`Serveur ${server.name}`} note={`Export du ${formatDateTime(reading)} · relu chaque heure`} />

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
        <Stat
          label="TDC total"
          value={`${formatDecimal(summary.field / 1_000_000)} M`}
          hint={`${formatNumber(summary.field)} cm²`}
        />
      </StatGrid>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Joueurs inscrits"
          aside={<span className="font-mono text-xs text-muted-foreground">par jour</span>}
        >
          <ScoreChart
            label="Joueurs"
            unit="joueurs"
            points={summary.playersPerDay.map((row) => ({ day: dayMonth(row.day), value: row.players }))}
          />
        </Panel>
        <Panel
          title="TDC total du serveur"
          aside={<span className="font-mono text-xs text-muted-foreground">relevé de minuit</span>}
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
                  <TableCell className="pl-4 font-mono text-primary">{String(index + 1).padStart(2, "0")}</TableCell>
                  <TableCell>
                    <Link href={`/${server.id}/players/${String(player.id)}`} className="font-semibold hover:underline">
                      {player.pseudo}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {player.alliance ? (
                      <Link href={allianceHref(player.alliance)} className="hover:underline">
                        {player.alliance}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-4 text-right font-mono">{formatNumber(player.field)}</TableCell>
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
                  <TableCell className="pl-4 font-mono text-primary">{String(index + 1).padStart(2, "0")}</TableCell>
                  <TableCell className="max-w-56 truncate">
                    <Link href={allianceHref(alliance.tag)} className="hover:underline">
                      <strong>{alliance.tag}</strong>{" "}
                      <span className="text-muted-foreground">{alliance.name.trim()}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatNumber(alliance.playersCount)}</TableCell>
                  <TableCell className="pr-4 text-right font-mono">{formatNumber(alliance.totalField)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Activité du Journal"
          aside={<span className="text-xs text-muted-foreground">30 derniers jours</span>}
        >
          <JournalActivityChart
            points={summary.journalDays.map(({ day, ...groups }) => ({ day: dayMonth(day), ...groups }))}
          />
        </Panel>
        <Panel flush title="Derniers changements">
          <JournalList server={server.id} lines={summary.journal.slice(0, 10)} named />
        </Panel>
      </div>
    </div>
  );
}
