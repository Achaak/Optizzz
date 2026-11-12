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
  const head = (label: string, choice: AllianceSort, className?: string) => (
    <SortableHead
      label={label}
      sort={choice}
      current={sort}
      href={queryHref(path, { q, tri: choice === "field" ? "" : choice })}
      className={className}
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader kicker={`Serveur ${server.name}`} title={`Alliances de ${server.name}`}>
        Toutes les alliances du serveur, triables par score. Relues chaque heure depuis l&apos;export public.
      </PageHeader>
      <div className="overflow-hidden rounded-[0.875rem] bg-card shadow-panel">
        <FilterBar
          action={path}
          count={total === 0 ? "Aucune alliance" : `${formatNumber(total)} ${total > 1 ? "alliances" : "alliance"}`}
        >
          <FilterField label="Tag ou nom">
            <Input name="q" defaultValue={q} className="h-9 w-48" />
          </FilterField>
          {sort !== "field" && <input type="hidden" name="tri" value={sort} />}
        </FilterBar>
        {alliances.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14 pl-4">#</TableHead>
                {head("Alliance", "tag")}
                {head("Membres", "members", "text-right")}
                {head("TDC", "field", "text-right")}
                {head("Fourmilière", "building", "hidden text-right md:table-cell")}
                {head("Technologie", "technology", "hidden text-right md:table-cell")}
                {head("Combat", "trophy", "hidden pr-4 text-right lg:table-cell")}
              </TableRow>
            </TableHeader>
            <TableBody>
              {alliances.map((alliance, index) => (
                <TableRow key={alliance.tag}>
                  <TableCell className="pl-4 text-primary">
                    {String((page - 1) * PAGE_SIZE + index + 1).padStart(2, "0")}
                  </TableCell>
                  <TableCell className="max-w-64 truncate">
                    <Link href={`${path}/${encodeURIComponent(alliance.tag)}`} className="hover:underline">
                      <strong>{alliance.tag}</strong>{" "}
                      <span className="text-muted-foreground">{alliance.name.trim()}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">{formatNumber(alliance.playersCount)}</TableCell>
                  <TableCell className="text-right">{formatNumber(alliance.totalField)}</TableCell>
                  <TableCell className="hidden text-right md:table-cell">
                    {formatNumber(alliance.totalBuildingScore)}
                  </TableCell>
                  <TableCell className="hidden text-right md:table-cell">
                    {formatNumber(alliance.totalTechnologyScore)}
                  </TableCell>
                  <TableCell className="hidden pr-4 text-right lg:table-cell">
                    {formatNumber(alliance.totalTrophyScore)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">Aucune alliance ne correspond.</p>
        )}
        {alliances.length > 0 && <AdSlot className="border-t px-4 pt-3" />}
        <Pager
          path={path}
          query={{ q, tri: sort === "field" ? "" : sort }}
          page={page}
          pages={Math.ceil(total / PAGE_SIZE)}
        />
      </div>
    </div>
  );
}
