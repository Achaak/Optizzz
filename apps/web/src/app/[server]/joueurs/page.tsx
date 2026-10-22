import { formatNumber } from "@optizzz/game/format/number-format";
import type { Metadata } from "next";
import Link from "next/link";
import { Pager } from "~/components/pager";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { choiceOf, pageOf, serverOfPath, textOf } from "~/lib/game-server";
import { listPlayers, PAGE_SIZE, type PlayerSort } from "~/server/queries";

interface Props {
  params: Promise<{ server: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const SORTS: readonly [PlayerSort, ...PlayerSort[]] = ["field", "building", "technology", "trophy", "pseudo"];
const SORT_LABELS: Record<PlayerSort, string> = {
  field: "TDC",
  building: "Fourmilière",
  technology: "Technologie",
  trophy: "Combat",
  pseudo: "Pseudo",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const server = serverOfPath((await params).server, "/joueurs");
  return { title: `Joueurs de ${server.name}` };
}

export default async function PlayersPage({ params, searchParams }: Props) {
  const server = serverOfPath((await params).server, "/joueurs");
  const query = await searchParams;
  const q = textOf(query.q);
  const alliance = textOf(query.alliance);
  const sort = choiceOf(query.tri, SORTS);
  const page = pageOf(query.page);
  const { total, players } = await listPlayers(server.id, { q, alliance, sort, page });
  const path = `/${server.id}/joueurs`;
  const kept = { q, alliance, tri: sort === "field" ? "" : sort };

  return (
    <div className="space-y-4">
      <form action={path} className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span className="block">Pseudo</span>
          <Input name="q" defaultValue={q} placeholder="Une partie du pseudo" className="w-48" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="block">Alliance</span>
          <Input name="alliance" defaultValue={alliance} placeholder="Tag" className="w-28" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="block">Trier par</span>
          <select
            name="tri"
            defaultValue={sort}
            className="block h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
          >
            {SORTS.map((choice) => (
              <option key={choice} value={choice}>
                {SORT_LABELS[choice]}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit">Afficher</Button>
      </form>
      <p className="text-sm text-muted-foreground">
        {total === 0 ? "Aucun joueur ne correspond." : `${formatNumber(total)} ${total > 1 ? "joueurs" : "joueur"}`}
      </p>
      {players.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-right">#</TableHead>
              <TableHead>Joueur</TableHead>
              <TableHead>Alliance</TableHead>
              <TableHead className="text-right">TDC</TableHead>
              <TableHead className="text-right">Fourmilière</TableHead>
              <TableHead className="text-right">Technologie</TableHead>
              <TableHead className="text-right">Combat</TableHead>
              <TableHead>État</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {players.map((player, index) => (
              <TableRow key={player.id}>
                <TableCell className="text-right text-muted-foreground tabular-nums">
                  {(page - 1) * PAGE_SIZE + index + 1}
                </TableCell>
                <TableCell>
                  <Link href={`/${server.id}/joueurs/${String(player.id)}`} className="hover:underline">
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
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(player.field)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(player.buildingScore)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(player.technologyScore)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(player.trophyScore)}</TableCell>
                <TableCell className="space-x-1">
                  {player.masterId !== null && <Badge variant="secondary">Colonisé</Badge>}
                  {player.onHoliday && <Badge variant="outline">Vacances</Badge>}
                  {player.isBanned && <Badge variant="destructive">Banni</Badge>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Pager path={path} query={kept} page={page} pages={Math.ceil(total / PAGE_SIZE)} />
    </div>
  );
}
