"use client";

import { formatNumber } from "@optizzz/game/format/number-format";
import type { ReactNode } from "react";
import { PanelLink } from "~/components/panel";
import { useCurrentServer } from "~/components/server-picker";
import { TableCell, TableRow } from "~/components/ui/table";

/** Of the servers' blocks rendered on the server, the one of the server this browser last visited, else `fallback`. */
export function RememberedServer({ blocks, fallback }: { blocks: Record<string, ReactNode>; fallback: string }) {
  const { server } = useCurrentServer();
  return blocks[server && server.id in blocks ? server.id : fallback] ?? null;
}

/**
 * A server's line in the servers' table: its players and whether the cron reads it. The server this browser last
 * visited stands out, in words (« Votre serveur ») as well as in colour.
 */
export function ServerRow({ id, name, players }: { id: string; name: string; players: number | null }) {
  const { server } = useCurrentServer();
  const yours = server?.id === id;
  return (
    <TableRow className={yours ? "bg-accent hover:bg-accent" : undefined}>
      <TableCell className={`py-2.5 pl-4 font-heading text-[1.375rem] font-bold ${yours ? "text-primary" : ""}`}>
        {name}
      </TableCell>
      <TableCell className="px-2 text-right font-mono text-[0.9375rem] sm:px-4">
        {players === null ? <span className="text-muted-foreground">—</span> : formatNumber(players)}
      </TableCell>
      <TableCell className={`px-4 text-[0.9375rem] whitespace-normal ${yours ? "" : "text-muted-foreground"}`}>
        {yours ? "Votre serveur" : players === null ? "Pas encore relu" : "Relu chaque heure"}
      </TableCell>
      <TableCell className="pr-4 text-right">
        {players !== null && <PanelLink href={`/${id}`}>Ouvrir</PanelLink>}
      </TableCell>
    </TableRow>
  );
}
