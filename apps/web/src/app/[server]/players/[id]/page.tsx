import { formatNumber } from "@optizzz/game/format/number-format";
import { dayMonth } from "@optizzz/game/format/time-format";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdSlot } from "~/components/ad-slot";
import { JournalList } from "~/components/journal-list";
import { MonoLabel, PageHeader, Panel, PanelLink } from "~/components/panel";
import { ScoreChart } from "~/components/score-chart";
import { Stat, StatGrid } from "~/components/stat";
import { serverOfPath } from "~/lib/game-server";
import { ordinal } from "~/lib/server-stats";
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
  const server = serverOfPath(segment, `/players/${id}`);
  const playerId = idOf(id);
  const { player } = playerId === null ? { player: null } : await playerPage(server.id, playerId);
  // Public in the export, but a player's own page stays out of the search engines.
  return { title: player ? `${player.pseudo} (${server.name})` : "Joueur inconnu", robots: { index: false } };
}

export default async function PlayerPage({ params }: Props) {
  const { server: segment, id } = await params;
  const server = serverOfPath(segment, `/players/${id}`);
  const playerId = idOf(id);
  if (playerId === null) notFound();
  const { player, master, colonies, days, journal, rank, ranks } = await playerPage(server.id, playerId);
  if (!player && journal.length === 0) notFound();
  const points = (pick: (day: (typeof days)[number]) => number) =>
    days.map((day) => ({ day: dayMonth(day.day), value: Math.round(pick(day)) }));
  const states = player
    ? [master && "Colonisé", player.onHoliday && "En vacances", player.isBanned && "Banni"].filter(Boolean)
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={player?.pseudo ?? journal[0]?.name}
        note={player ? `Serveur ${server.name} · ${String(player.x)} : ${String(player.y)}` : undefined}
      >
        {player ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {player.alliance ? (
              <Link
                href={`/${server.id}/alliances/${encodeURIComponent(player.alliance)}`}
                className="font-semibold text-foreground hover:underline"
              >
                Alliance {player.alliance}
              </Link>
            ) : (
              <span>Sans alliance</span>
            )}
            {master && (
              <span>
                Colonisé par{" "}
                <Link href={`/${server.id}/players/${String(master.id)}`} className="text-foreground hover:underline">
                  {master.pseudo}
                </Link>
              </span>
            )}
            {states.length > 0 && <MonoLabel className="text-primary">{states.join(" · ")}</MonoLabel>}
            <PanelLink href={`/${server.id}/map?player=${String(player.id)}`}>Voir sur la carte</PanelLink>
            <PanelLink href={`/${server.id}/compare?ids=${String(player.id)}`}>Comparer</PanelLink>
          </div>
        ) : (
          <p className="text-sm">Ce joueur n&apos;est plus dans l&apos;export du serveur.</p>
        )}
      </PageHeader>

      {player && (
        <StatGrid label="Scores">
          <Stat label="TDC" value={formatNumber(player.field)} hint="cm²" />
          <Stat label="Rang" value={rank === null ? "—" : ordinal(rank)} hint="au TDC sur le serveur" />
          <Stat label="Fourmilière" value={formatNumber(player.buildingScore)} />
          <Stat label="Technologie" value={formatNumber(player.technologyScore)} />
          <Stat label="Combat" value={formatNumber(player.trophyScore)} />
          <Stat label="Colonies" value={formatNumber(colonies.length)} />
        </StatGrid>
      )}

      {colonies.length > 0 && (
        <Panel title="Colonies">
          <ul className="flex flex-wrap gap-2 text-sm">
            {colonies.map((colony) => (
              <li key={colony.id}>
                <Link
                  href={`/${server.id}/players/${String(colony.id)}`}
                  className="inline-block border px-2 py-1 hover:bg-accent"
                >
                  {colony.pseudo}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="TDC">
          <ScoreChart label="TDC (cm²)" unit="cm² de TDC" points={points((day) => day.field)} />
        </Panel>
        <Panel title="Rang au TDC" aside={<span className="text-xs text-muted-foreground">1 en haut</span>}>
          <ScoreChart
            label="Rang"
            unit="ᵉ au TDC"
            tone="blue"
            reversed
            points={ranks.map((row) => ({ day: dayMonth(row.day), value: row.rank }))}
          />
        </Panel>
        <Panel title="Fourmilière">
          <ScoreChart label="Fourmilière" unit="en Fourmilière" points={points((day) => day.buildingScore)} />
        </Panel>
        <Panel title="Technologie">
          <ScoreChart
            label="Technologie"
            unit="en Technologie"
            tone="blue"
            points={points((day) => day.technologyScore)}
          />
        </Panel>
        <Panel title="Combat">
          <ScoreChart label="Combat" unit="en Combat" points={points((day) => day.trophyScore)} />
        </Panel>
        <Panel flush title="Changements">
          <JournalList server={server.id} lines={journal} named={false} />
        </Panel>
      </div>

      <AdSlot />
    </div>
  );
}
