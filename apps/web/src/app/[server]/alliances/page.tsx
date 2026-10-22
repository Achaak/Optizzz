import { formatNumber } from "@optizzz/game/format/number-format";
import type { Metadata } from "next";
import Link from "next/link";
import { Pager } from "~/components/pager";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { choiceOf, pageOf, serverOfPath, textOf } from "~/lib/game-server";
import { listAlliances, PAGE_SIZE, type AllianceSort } from "~/server/queries";

interface Props {
  params: Promise<{ server: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const SORTS: readonly [AllianceSort, ...AllianceSort[]] = [
  "field",
  "members",
  "building",
  "technology",
  "trophy",
  "tag",
];
const SORT_LABELS: Record<AllianceSort, string> = {
  field: "TDC",
  members: "Membres",
  building: "Fourmilière",
  technology: "Technologie",
  trophy: "Combat",
  tag: "Tag",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const server = serverOfPath((await params).server, "/alliances");
  return { title: `Alliances de ${server.name}` };
}

export default async function AlliancesPage({ params, searchParams }: Props) {
  const server = serverOfPath((await params).server, "/alliances");
  const query = await searchParams;
  const q = textOf(query.q);
  const sort = choiceOf(query.tri, SORTS);
  const page = pageOf(query.page);
  const { total, alliances } = await listAlliances(server.id, { q, sort, page });
  const path = `/${server.id}/alliances`;

  return (
    <div className="space-y-4">
      <form action={path} className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span className="block">Tag ou nom</span>
          <Input name="q" defaultValue={q} className="w-48" />
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
        {total === 0
          ? "Aucune alliance ne correspond."
          : `${formatNumber(total)} ${total > 1 ? "alliances" : "alliance"}`}
      </p>
      {alliances.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-right">#</TableHead>
              <TableHead>Alliance</TableHead>
              <TableHead className="text-right">Membres</TableHead>
              <TableHead className="text-right">TDC</TableHead>
              <TableHead className="text-right">Fourmilière</TableHead>
              <TableHead className="text-right">Technologie</TableHead>
              <TableHead className="text-right">Combat</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alliances.map((alliance, index) => (
              <TableRow key={alliance.tag}>
                <TableCell className="text-right text-muted-foreground tabular-nums">
                  {(page - 1) * PAGE_SIZE + index + 1}
                </TableCell>
                <TableCell>
                  <Link href={`${path}/${encodeURIComponent(alliance.tag)}`} className="hover:underline">
                    {alliance.tag}
                  </Link>{" "}
                  <span className="text-muted-foreground">{alliance.name.trim()}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(alliance.playersCount)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(alliance.totalField)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(alliance.totalBuildingScore)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(alliance.totalTechnologyScore)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(alliance.totalTrophyScore)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Pager
        path={path}
        query={{ q, tri: sort === "field" ? "" : sort }}
        page={page}
        pages={Math.ceil(total / PAGE_SIZE)}
      />
    </div>
  );
}
