"use client";

import { formatNumber } from "@optizzz/game/format/number-format";
import { cn } from "cn";
import Link from "next/link";
import { useState } from "react";
import { SmallLabel, Panel } from "~/components/panel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";

export interface MemberRow {
  id: number;
  pseudo: string;
  x: number;
  y: number;
  field: number;
  building: number;
  technology: number;
  trophy: number;
  /** « ▲ 41 210 »: the TDC's move in 7 days, missing for a newcomer. */
  week?: string;
  master: { id: number; pseudo: string } | null;
}

type MemberSort = "field" | "building" | "technology" | "trophy";

const SORTS: { id: MemberSort; label: string }[] = [
  { id: "field", label: "TDC" },
  { id: "building", label: "Fourmilière" },
  { id: "technology", label: "Technologie" },
  { id: "trophy", label: "Combat" },
];

/** Rows shown before « Voir les 32 membres ». */
const FOLDED_ROWS = 10;

const head = "text-xs font-medium text-muted-foreground";

/**
 * The « Membres » panel of an alliance: sorted by a score picked in its header (in the page, without reloading it),
 * the first rows only until « Voir les 32 membres ».
 */
export function MembersTable({ server, members }: { server: string; members: MemberRow[] }) {
  const [sort, setSort] = useState<MemberSort>("field");
  const [unfolded, setUnfolded] = useState(false);
  const sorted = [...members].sort((a, b) => b[sort] - a[sort]);
  const shown = unfolded ? sorted : sorted.slice(0, FOLDED_ROWS);
  const score = SORTS.find((entry) => entry.id === sort);
  return (
    <Panel
      flush
      title="Membres"
      aside={
        <div role="group" aria-label="Trier les membres" className="flex flex-wrap items-center gap-2">
          <SmallLabel>Trier</SmallLabel>
          <div className="flex flex-wrap gap-0.5 rounded-full bg-raised p-[3px]">
            {SORTS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                aria-pressed={entry.id === sort}
                onClick={() => setSort(entry.id)}
                className={cn(
                  "rounded-full px-2 py-1 text-sm whitespace-nowrap sm:px-3",
                  entry.id === sort
                    ? "bg-primary font-semibold text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={cn(head, "w-12 pl-4")}>#</TableHead>
            <TableHead className={head}>Joueur</TableHead>
            <TableHead className={cn(head, "hidden text-right sm:table-cell")}>Position</TableHead>
            <TableHead className={cn(head, "text-right")}>TDC</TableHead>
            <TableHead className={cn(head, "hidden text-right sm:table-cell")}>7 jours</TableHead>
            {sort !== "field" && <TableHead className={cn(head, "text-right")}>{score?.label}</TableHead>}
            <TableHead className={cn(head, "hidden pr-4 md:table-cell")}>Colonisé par</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((member, index) => (
            <TableRow key={member.id}>
              <TableCell className="pl-4">{String(index + 1).padStart(2, "0")}</TableCell>
              <TableCell>
                <Link href={`/${server}/players/${String(member.id)}`} className="font-semibold hover:underline">
                  {member.pseudo}
                </Link>
              </TableCell>
              <TableCell className="hidden text-right text-muted-foreground sm:table-cell">
                {member.x} : {member.y}
              </TableCell>
              <TableCell className="text-right">{formatNumber(member.field)}</TableCell>
              <TableCell className="hidden text-right sm:table-cell">{member.week ?? "—"}</TableCell>
              {sort !== "field" && <TableCell className="text-right">{formatNumber(member[sort])}</TableCell>}
              <TableCell className="hidden pr-4 md:table-cell">
                {member.master ? (
                  <Link href={`/${server}/players/${String(member.master.id)}`} className="hover:underline">
                    {member.master.pseudo}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {members.length > FOLDED_ROWS && (
        <div className="border-t px-4 py-2.5">
          <button
            type="button"
            aria-expanded={unfolded}
            onClick={() => setUnfolded(!unfolded)}
            className="text-sm font-semibold text-primary hover:underline"
          >
            {unfolded
              ? `N'afficher que les ${String(FOLDED_ROWS)} premiers ↑`
              : `Voir les ${formatNumber(members.length)} membres ↓`}
          </button>
        </div>
      )}
    </Panel>
  );
}
