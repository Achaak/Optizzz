import { formatNumber } from "@optizzz/game/format/number-format";
import { dayMonth } from "@optizzz/game/format/time-format";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JournalList } from "~/components/journal-list";
import { ScoreChart } from "~/components/score-chart";
import { Stat } from "~/components/stat";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { serverOfPath } from "~/lib/game-server";
import { playerPage } from "~/server/queries";

export const revalidate = 3600;
// Built at the first visit, then kept until the cron's next pass.
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

interface Props {
  params: Promise<{ server: string; id: string }>;
}

const idOf = (text: string) => (/^\d+$/.test(text) ? Number(text) : null);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { server: segment, id } = await params;
  const server = serverOfPath(segment, `/joueurs/${id}`);
  const playerId = idOf(id);
  const { player } = playerId === null ? { player: null } : await playerPage(server.id, playerId);
  // Public in the export, but a player's own page stays out of the search engines.
  return { title: player ? `${player.pseudo} (${server.name})` : "Joueur inconnu", robots: { index: false } };
}

export default async function PlayerPage({ params }: Props) {
  const { server: segment, id } = await params;
  const server = serverOfPath(segment, `/joueurs/${id}`);
  const playerId = idOf(id);
  if (playerId === null) notFound();
  const { player, master, colonies, days, journal } = await playerPage(server.id, playerId);
  if (!player && journal.length === 0) notFound();
  const points = (pick: (day: (typeof days)[number]) => number) =>
    days.map((day) => ({ day: dayMonth(day.day), value: pick(day) }));

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{player?.pseudo ?? journal[0]?.name}</h1>
        {player ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {player.alliance ? (
              <Link href={`/${server.id}/alliances/${encodeURIComponent(player.alliance)}`} className="hover:underline">
                Alliance {player.alliance}
              </Link>
            ) : (
              <span className="text-muted-foreground">Sans alliance</span>
            )}
            <span className="text-muted-foreground">
              · Position {player.x} : {player.y}
            </span>
            <Link
              href={`/${server.id}/carte?joueur=${String(player.id)}`}
              className="underline-offset-2 hover:underline"
            >
              Voir sur la carte
            </Link>
            {master && (
              <Badge variant="secondary">
                <Link href={`/${server.id}/joueurs/${String(master.id)}`}>Colonisé par {master.pseudo}</Link>
              </Badge>
            )}
            {player.onHoliday && <Badge variant="outline">En vacances</Badge>}
            {player.isBanned && <Badge variant="destructive">Banni</Badge>}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Ce joueur n&apos;est plus dans l&apos;export du serveur.</p>
        )}
      </header>

      {player && (
        <section aria-label="Scores" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="TDC (cm²)" value={formatNumber(player.field)} />
          <Stat label="Fourmilière" value={formatNumber(player.buildingScore)} />
          <Stat label="Technologie" value={formatNumber(player.technologyScore)} />
          <Stat label="Combat" value={formatNumber(player.trophyScore)} />
        </section>
      )}

      {colonies.length > 0 && (
        <p className="text-sm">
          Colonies :{" "}
          {colonies.map((colony, index) => (
            <span key={colony.id}>
              {index > 0 && ", "}
              <Link href={`/${server.id}/joueurs/${String(colony.id)}`} className="hover:underline">
                {colony.pseudo}
              </Link>
            </span>
          ))}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>TDC, jour après jour</CardTitle>
          </CardHeader>
          <CardContent>
            <ScoreChart label="TDC" points={points((day) => day.field)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Fourmilière, jour après jour</CardTitle>
          </CardHeader>
          <CardContent>
            <ScoreChart label="Fourmilière" points={points((day) => day.buildingScore)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Technologie, jour après jour</CardTitle>
          </CardHeader>
          <CardContent>
            <ScoreChart label="Technologie" points={points((day) => day.technologyScore)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Changements</CardTitle>
          </CardHeader>
          <CardContent>
            <JournalList server={server.id} lines={journal} named={false} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
