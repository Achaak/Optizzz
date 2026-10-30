import { formatNumber } from "@optizzz/game/format/number-format";
import type { Metadata } from "next";
import Link from "next/link";
import { AdSlot } from "~/components/ad-slot";
import { FilterBar, FilterField, queryHref, SortableHead } from "~/components/list-parts";
import { Pager } from "~/components/pager";
import { PageHeader } from "~/components/panel";
import { Input } from "~/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { choiceOf, pageOf, serverOfPath, textOf } from "~/lib/game-server";
import { listPlayers, PAGE_SIZE, type PlayerSort } from "~/server/queries";

interface Props {
  params: Promise<{ server: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const SORTS: readonly [PlayerSort, ...PlayerSort[]] = ["field", "building", "technology", "trophy", "pseudo"];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const server = serverOfPath((await params).server, "/players");
  return { title: `Joueurs de ${server.name}` };
}

/** A player's states, in words: the list shows them only when there is one. */
function PlayerStates({ colonized, holiday, banned }: { colonized: boolean; holiday: boolean; banned: boolean }) {
  const states = [colonized && "Colonisé", holiday && "Vacances", banned && "Banni"].filter(Boolean);
  if (states.length === 0) return null;
  return (
    <span className="font-mono text-[0.6875rem] tracking-wider text-muted-foreground uppercase">
      {states.join(" · ")}
    </span>
  );
}

export default async function PlayersPage({ params, searchParams }: Props) {
  const server = serverOfPath((await params).server, "/players");
  const query = await searchParams;
  const q = textOf(query.q);
  const alliance = textOf(query.alliance);
  const sort = choiceOf(query.tri, SORTS);
  const page = pageOf(query.page);
  const { total, players } = await listPlayers(server.id, { q, alliance, sort, page });
  const path = `/${server.id}/players`;
  const kept = { q, alliance, tri: sort === "field" ? "" : sort };
  const sortHref = (choice: PlayerSort) => queryHref(path, { q, alliance, tri: choice === "field" ? "" : choice });
  const head = (label: string, choice: PlayerSort, className?: string) => (
    <SortableHead label={label} sort={choice} current={sort} href={sortHref(choice)} className={className} />
  );

  return (
    <div className="space-y-6">
      <PageHeader kicker={`Serveur ${server.name}`} title={`Joueurs de ${server.name}`}>
        Tous les joueurs du serveur, triables par score. Relus chaque heure depuis l&apos;export public.
      </PageHeader>
      <div className="border bg-card">
        <FilterBar
          action={path}
          count={total === 0 ? "Aucun joueur" : `${formatNumber(total)} ${total > 1 ? "joueurs" : "joueur"}`}
        >
          <FilterField label="Pseudo">
            <Input name="q" defaultValue={q} placeholder="Une partie du pseudo" className="h-9 w-48" />
          </FilterField>
          <FilterField label="Alliance">
            <Input name="alliance" defaultValue={alliance} placeholder="Tag" className="h-9 w-28" />
          </FilterField>
          {sort !== "field" && <input type="hidden" name="tri" value={sort} />}
        </FilterBar>
        {players.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14 pl-4">#</TableHead>
                {head("Joueur", "pseudo")}
                <TableHead>Alliance</TableHead>
                {head("TDC", "field", "text-right")}
                {head("Fourmilière", "building", "hidden text-right md:table-cell")}
                {head("Technologie", "technology", "hidden text-right md:table-cell")}
                {head("Combat", "trophy", "hidden text-right lg:table-cell")}
                <TableHead className="hidden pr-4 sm:table-cell">État</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.map((player, index) => (
                <TableRow key={player.id}>
                  <TableCell className="pl-4 font-mono text-primary">
                    {String((page - 1) * PAGE_SIZE + index + 1).padStart(2, "0")}
                  </TableCell>
                  <TableCell>
                    <Link href={`${path}/${String(player.id)}`} className="font-semibold hover:underline">
                      {player.pseudo}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {player.alliance ? (
                      <Link
                        href={`/${server.id}/alliances/${encodeURIComponent(player.alliance)}`}
                        className="hover:underline"
                      >
                        {player.alliance}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatNumber(player.field)}</TableCell>
                  <TableCell className="hidden text-right font-mono md:table-cell">
                    {formatNumber(player.buildingScore)}
                  </TableCell>
                  <TableCell className="hidden text-right font-mono md:table-cell">
                    {formatNumber(player.technologyScore)}
                  </TableCell>
                  <TableCell className="hidden text-right font-mono lg:table-cell">
                    {formatNumber(player.trophyScore)}
                  </TableCell>
                  <TableCell className="hidden pr-4 sm:table-cell">
                    <PlayerStates
                      colonized={player.masterId !== null}
                      holiday={player.onHoliday}
                      banned={player.isBanned}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">Aucun joueur ne correspond.</p>
        )}
        <AdSlot className="border-t px-4 pt-3" />
        <Pager path={path} query={kept} page={page} pages={Math.ceil(total / PAGE_SIZE)} />
      </div>
    </div>
  );
}
