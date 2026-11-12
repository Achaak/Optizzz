import { formatNumber } from "@optizzz/game/format/number-format";
import { dayMonth } from "@optizzz/game/format/time-format";
import type { Metadata } from "next";
import Link from "next/link";
import { AllianceCrest } from "~/components/alliance-crest";
import { notFound } from "next/navigation";
import { PlusIcon } from "~/components/icons";
import { JournalList } from "~/components/journal-list";
import { SmallLabel, PageHeader, Panel, PanelLink } from "~/components/panel";
import { ScoreChart } from "~/components/score-chart";
import { Stat, StatGrid } from "~/components/stat";
import { CopyLinkButton } from "~/components/tools/copy-link-button";
import { buttonVariants } from "~/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { serverOfPath } from "~/lib/game-server";
import { ordinal, trendText } from "~/lib/server-stats";
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

const outline = buttonVariants({ variant: "outline", size: "lg" });

// The mockups' table heads: small mono capitals, like the stats' labels.
const HEAD = "text-xs font-medium";

/** The colonies' names under their count: the first three, then how many more. */
function coloniesHint(names: string[]): string | undefined {
  if (names.length === 0) return undefined;
  if (names.length <= 4) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} et ${formatNumber(names.length - 3)} autres`;
}

const idOf = (text: string) => (/^\d+$/.test(text) ? Number(text) : null);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { server: segment, id } = await params;
  const server = serverOfPath(segment, `/players/${id}`);
  const playerId = idOf(id);
  const { player, journal } = playerId === null ? { player: null, journal: [] } : await playerPage(server.id, playerId);
  // A player gone from the export keeps the name its Journal last knew.
  const name = player?.pseudo ?? journal[0]?.name;
  // Public in the export, but a player's own page stays out of the search engines.
  return { title: name ? `${name} (${server.name})` : "Joueur inconnu", robots: { index: false } };
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
  const week = (text: string | undefined) => (text ? `${text} en 7 jours` : undefined);
  const weekBefore = days.at(-8);

  return (
    <div className="space-y-6">
      <PageHeader
        kicker={`Joueur · ${server.name}`}
        title={player?.pseudo ?? journal[0]?.name}
        actions={
          player && (
            <>
              <Link href={`/${server.id}/map?player=${String(player.id)}`} className={outline}>
                Voir sur la carte
              </Link>
              <Link href={`/${server.id}/compare?ids=${String(player.id)}`} className={outline}>
                <PlusIcon />
                Comparer
              </Link>
              <CopyLinkButton />
            </>
          )
        }
      >
        {player ? (
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            {player.alliance ? (
              <span>
                Membre de{" "}
                <Link
                  href={`/${server.id}/alliances/${encodeURIComponent(player.alliance)}`}
                  className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
                >
                  <AllianceCrest tag={player.alliance} size="xs" />
                  {player.alliance}
                </Link>
              </span>
            ) : (
              <span>Sans alliance</span>
            )}
            <span aria-hidden>·</span>
            <span>
              position {String(player.x)} : {String(player.y)}
            </span>
            <span aria-hidden>·</span>
            {master ? (
              <span>
                colonisé par{" "}
                <Link
                  href={`/${server.id}/players/${String(master.id)}`}
                  className="font-semibold text-foreground hover:underline"
                >
                  {master.pseudo}
                </Link>
              </span>
            ) : (
              <span>libre (personne ne le colonise)</span>
            )}
            {states.length > 0 && <SmallLabel className="ml-2 text-primary">{states.join(" · ")}</SmallLabel>}
          </p>
        ) : (
          <p>Ce joueur n&apos;est plus dans l&apos;export du serveur.</p>
        )}
      </PageHeader>

      {player && (
        <StatGrid label="Scores">
          <Stat
            label="TDC"
            value={formatNumber(player.field)}
            hint={`cm²${weekBefore ? ` · ${week(trendText(weekBefore.field, player.field)) ?? ""}` : ""}`}
          />
          <Stat
            label="Rang"
            value={rank === null ? "—" : ordinal(rank)}
            hint={
              rank === null
                ? undefined
                : ["au TDC sur le serveur", week(trendText(ranks.at(-8)?.rank, rank, true))].filter(Boolean).join(" · ")
            }
          />
          <Stat label="Fourmilière" value={formatNumber(player.buildingScore)} />
          <Stat label="Technologie" value={formatNumber(player.technologyScore)} />
          <Stat label="Combat" value={formatNumber(player.trophyScore)} />
          <Stat
            label="Colonies"
            value={formatNumber(colonies.length)}
            hint={coloniesHint(colonies.map((colony) => colony.pseudo))}
          />
        </StatGrid>
      )}

      {/* A player gone from the export has no rank: its TDC curve alone, full width. */}
      <div className={player ? "grid gap-6 lg:grid-cols-2" : "grid gap-6"}>
        <Panel title="TDC" aside={<span className="text-xs text-muted-foreground">cm², relevé de minuit</span>}>
          <ScoreChart label="TDC (cm²)" unit="cm² de TDC" points={points((day) => day.field)} />
        </Panel>
        {player && (
          <Panel
            title="Rang au TDC"
            aside={<span className="text-xs text-muted-foreground">plus haut = mieux classé</span>}
          >
            <ScoreChart
              label="Rang"
              unit="ᵉ au TDC"
              tone="blue"
              reversed
              points={ranks.map((row) => ({ day: dayMonth(row.day), value: row.rank }))}
            />
          </Panel>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Panel title="Fourmilière">
          <ScoreChart small label="Fourmilière" unit="en Fourmilière" points={points((day) => day.buildingScore)} />
        </Panel>
        <Panel title="Technologie">
          <ScoreChart
            small
            label="Technologie"
            unit="en Technologie"
            tone="blue"
            points={points((day) => day.technologyScore)}
          />
        </Panel>
        <Panel title="Combat">
          <ScoreChart small label="Combat" unit="en Combat" points={points((day) => day.trophyScore)} />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          flush
          title={`Journal de ${player?.pseudo ?? journal[0]?.name ?? ""}`}
          aside={<PanelLink href={`/${server.id}/journal`}>Tout le Journal du serveur</PanelLink>}
        >
          <JournalList server={server.id} lines={journal} named={false} />
        </Panel>
        <Panel flush title="Colonies">
          {colonies.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className={HEAD}>
                  <TableHead className="pl-4 text-muted-foreground">Joueur</TableHead>
                  <TableHead className="text-muted-foreground">Alliance</TableHead>
                  <TableHead className="pr-4 text-right text-muted-foreground">TDC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {colonies.map((colony) => (
                  <TableRow key={colony.id}>
                    <TableCell className="pl-4">
                      <Link
                        href={`/${server.id}/players/${String(colony.id)}`}
                        className="font-semibold hover:underline"
                      >
                        {colony.pseudo}
                      </Link>
                    </TableCell>
                    <TableCell>{colony.alliance ?? "—"}</TableCell>
                    <TableCell className="pr-4 text-right">{formatNumber(colony.field)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">Aucune colonie.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
