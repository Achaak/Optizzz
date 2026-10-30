"use client";

import { formatNumber } from "@optizzz/game/format/number-format";
import { cn } from "cn";
import Link from "next/link";
import { useState } from "react";
import { MonoLabel } from "~/components/panel";
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

/** An alliance's members, sorted by a score picked above the table (in the page, without reloading it). */
export function MembersTable({ server, members }: { server: string; members: MemberRow[] }) {
  const [sort, setSort] = useState<MemberSort>("field");
  const sorted = [...members].sort((a, b) => b[sort] - a[sort]);
  const score = SORTS.find((entry) => entry.id === sort);
  return (
    <>
      <div role="group" aria-label="Trier les membres" className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
        <MonoLabel>Trier</MonoLabel>
        <div className="flex flex-wrap border">
          {SORTS.map((entry, index) => (
            <button
              key={entry.id}
              type="button"
              aria-pressed={entry.id === sort}
              onClick={() => setSort(entry.id)}
              className={cn(
                "px-3 py-1 text-sm",
                index > 0 && "border-l",
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 pl-4">#</TableHead>
            <TableHead>Joueur</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Position</TableHead>
            <TableHead className="text-right">TDC</TableHead>
            <TableHead className="hidden text-right sm:table-cell">7 jours</TableHead>
            {sort !== "field" && <TableHead className="text-right">{score?.label}</TableHead>}
            <TableHead className="hidden pr-4 md:table-cell">Colonisé par</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((member, index) => (
            <TableRow key={member.id}>
              <TableCell className="pl-4 font-mono text-primary">{String(index + 1).padStart(2, "0")}</TableCell>
              <TableCell>
                <Link href={`/${server}/players/${String(member.id)}`} className="font-semibold hover:underline">
                  {member.pseudo}
                </Link>
              </TableCell>
              <TableCell className="hidden text-right font-mono text-muted-foreground sm:table-cell">
                {member.x} : {member.y}
              </TableCell>
              <TableCell className="text-right font-mono">{formatNumber(member.field)}</TableCell>
              <TableCell className="hidden text-right font-mono sm:table-cell">{member.week ?? "—"}</TableCell>
              {sort !== "field" && <TableCell className="text-right font-mono">{formatNumber(member[sort])}</TableCell>}
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
    </>
  );
}
