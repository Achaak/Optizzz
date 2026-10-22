"use client";

import type { Player } from "@optizzz/game/exports";
import { formatDecimal, formatNumber } from "@optizzz/game/format/number-format";
import { formatDuration } from "@optizzz/game/format/time-format";
import { sortRows, type SortKey, type TableRow } from "@optizzz/map/view";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow as Row } from "~/components/ui/table";

const COLUMNS: { key: SortKey | null; label: string; num?: boolean }[] = [
  { key: "pseudo", label: "Joueur" },
  { key: "alliance", label: "Alliance" },
  { key: null, label: "Coordonnées", num: true },
  { key: "distance", label: "Distance", num: true },
  { key: "distance", label: "Trajet", num: true },
  { key: "field", label: "TDC", num: true },
  { key: null, label: "État" },
  { key: null, label: "" },
];

const stateOf = (player: Player) =>
  [player.onHoliday && "vacances", player.masterPlayerId !== null && "colonisé"].filter(Boolean).join(", ");

/** The chosen players, nearest to the reference first. */
export function PlayerTable(props: {
  server: string;
  rows: TableRow[];
  onFocus: (playerId: number | null) => void;
  onZoom: (player: Player) => void;
  onReference: (player: Player) => void;
}) {
  const { server, rows, onFocus, onZoom, onReference } = props;
  /** The column clicked: Distance and Trajet sort alike, only the clicked one says it. */
  const [sort, setSort] = useState({ column: 3, key: "distance" as SortKey, descending: false });
  const sorted = useMemo(() => sortRows(rows, sort.key, sort.descending), [rows, sort]);
  if (rows.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Ajoutez des joueurs ou des alliances pour les voir ici, triés par distance.
      </p>
    );

  return (
    <div className="max-h-[28rem] overflow-auto rounded-xl border">
      <Table>
        <TableHeader className="sticky top-0 bg-background">
          <Row>
            {COLUMNS.map(({ key, label, num }, index) => (
              <TableHead
                key={index}
                className={num ? "text-right" : undefined}
                aria-sort={sort.column === index ? (sort.descending ? "descending" : "ascending") : undefined}
              >
                {key ? (
                  <button
                    type="button"
                    className="hover:underline"
                    onClick={() =>
                      setSort((current) => ({
                        column: index,
                        key,
                        descending: current.column === index ? !current.descending : key === "field",
                      }))
                    }
                  >
                    {label}
                    {sort.column === index && (sort.descending ? " ↓" : " ↑")}
                  </button>
                ) : (
                  label
                )}
              </TableHead>
            ))}
          </Row>
        </TableHeader>
        <TableBody>
          {sorted.map(({ player, chip, distance, trip }) => (
            <Row key={player.id} onMouseEnter={() => onFocus(player.id)} onMouseLeave={() => onFocus(null)}>
              <TableCell>
                <button
                  type="button"
                  className="underline-offset-2 hover:underline"
                  title="Mesurer les distances depuis ce joueur"
                  onClick={() => onReference(player)}
                >
                  {player.pseudo}
                </button>{" "}
                <Link
                  href={`/${server}/joueurs/${String(player.id)}`}
                  className="text-muted-foreground"
                  title="Voir sa fiche"
                >
                  ↗
                </Link>
              </TableCell>
              <TableCell>
                <span
                  className="mr-2 inline-block size-2.5 rounded-full"
                  style={{ background: chip.color }}
                  aria-hidden
                />
                {player.alliance ?? "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {player.x} ; {player.y}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatDecimal(distance)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatDuration(trip.seconds * 1000)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(player.field)}</TableCell>
              <TableCell className="text-muted-foreground">{stateOf(player)}</TableCell>
              <TableCell>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={`Zoomer sur ${player.pseudo}`}
                  title="Zoomer sur ce joueur"
                  onClick={() => onZoom(player)}
                >
                  ⌕
                </button>
              </TableCell>
            </Row>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
