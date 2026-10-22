import { formatNumber } from "@optizzz/game/format/number-format";
import { dayMonth, formatDateTime } from "@optizzz/game/format/time-format";
import type { Metadata } from "next";
import Link from "next/link";
import { JournalList } from "~/components/journal-list";
import { ScoreChart } from "~/components/score-chart";
import { ReadingNote, Stat } from "~/components/stat";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { serverOfPath } from "~/lib/game-server";
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

export default async function ServerPage({ params }: Props) {
  const server = serverOfPath((await params).server);
  const [reading, summary] = await Promise.all([lastReading(server.id), serverSummary(server.id)]);
  if (!reading) return <ReadingNote text="Ce serveur n'a pas encore été relu par le site : revenez dans une heure." />;

  return (
    <div className="space-y-8">
      <ReadingNote text={`D'après l'export du ${formatDateTime(reading)}.`} />
      <section aria-label="Chiffres du serveur" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Joueurs" value={formatNumber(summary.players)} />
        <Stat label="Alliances" value={formatNumber(summary.alliances)} />
        <Stat label="Colonisés" value={formatNumber(summary.colonized)} />
        <Stat label="En vacances" value={formatNumber(summary.onHoliday)} />
        <Stat label="Bannis" value={formatNumber(summary.banned)} />
        <Stat label="TDC total (cm²)" value={formatNumber(summary.field)} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Premiers joueurs</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Joueur</TableHead>
                  <TableHead>Alliance</TableHead>
                  <TableHead className="text-right">TDC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.topPlayers.map((player) => (
                  <TableRow key={player.id}>
                    <TableCell>
                      <Link href={`/${server.id}/joueurs/${String(player.id)}`} className="hover:underline">
                        {player.pseudo}
                      </Link>
                    </TableCell>
                    <TableCell>{player.alliance ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(player.field)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Premières alliances</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alliance</TableHead>
                  <TableHead className="text-right">Membres</TableHead>
                  <TableHead className="text-right">TDC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.topAlliances.map((alliance) => (
                  <TableRow key={alliance.tag}>
                    <TableCell>
                      <Link
                        href={`/${server.id}/alliances/${encodeURIComponent(alliance.tag)}`}
                        className="hover:underline"
                      >
                        {alliance.tag}
                      </Link>{" "}
                      <span className="text-muted-foreground">{alliance.name.trim()}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(alliance.playersCount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(alliance.totalField)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Joueurs inscrits, jour après jour</CardTitle>
          </CardHeader>
          <CardContent>
            <ScoreChart
              label="Joueurs"
              points={summary.playersPerDay.map((row) => ({ day: dayMonth(row.day), value: row.players }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Derniers changements</CardTitle>
          </CardHeader>
          <CardContent>
            <JournalList server={server.id} lines={summary.journal} named />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
