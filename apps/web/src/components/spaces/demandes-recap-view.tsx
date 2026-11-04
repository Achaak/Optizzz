"use client";

// The « Récapitulatif » view of the Demandes tab (docs/features/site-demandes.md, « Récapitulatif et Historique »):
// each member's Demandes by status, those without a Demande too, the former members on one line and the alliance's
// total. The order is told by the arrow and the pressed header, never by a colour alone (ADR 0003).
import { formatNumber } from "@optizzz/game/format/number-format";
import { formatDateTime } from "@optizzz/game/format/time-format";
import { cn } from "cn";
import { useState } from "react";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import type { OpenedDemande } from "~/lib/demandes/demandes";
import {
  DEFAULT_RECAP_SORT,
  demandesRecap,
  sortRecap,
  type RecapKey,
  type RecapRow,
  type RecapSort,
} from "~/lib/demandes/recap";
import { Panel } from "./parts";

const COLUMNS: readonly { key: Exclude<RecapKey, "pseudo" | "last">; label: string }[] = [
  { key: "total", label: "Demandes" },
  { key: "pending", label: "À valider" },
  { key: "validated", label: "Validées" },
  { key: "closed", label: "Closes" },
  { key: "cancelled", label: "Annulées" },
  { key: "refused", label: "Refusées" },
];

/** The former members' Demandes, as the tab names their requester. */
export const FORMER_MEMBER = "un ancien membre";

export function DemandesRecapView({
  demandes,
  members,
  onShowHistory,
}: {
  demandes: readonly OpenedDemande[];
  members: readonly { playerId: number; pseudo: string }[];
  /** A pseudo: the Historique filtered on that requester. */
  onShowHistory: (requester: string) => void;
}) {
  const [sort, setSort] = useState<RecapSort>(DEFAULT_RECAP_SORT);
  const recap = demandesRecap(demandes, members);
  const rows = sortRecap(recap.rows, sort);
  const requesters = recap.rows.filter((r) => r.total > 0).length;

  /** The same header turns the order round; another starts from A to Z for the pseudo, the most for the rest. */
  const sortBy = (key: RecapKey) =>
    setSort((current) =>
      current.key === key ? { key, descending: !current.descending } : { key, descending: key !== "pseudo" },
    );

  const header = (key: RecapKey, label: string, className?: string) => {
    const active = sort.key === key;
    return (
      <TableHead
        key={key}
        className={className}
        aria-sort={active ? (sort.descending ? "descending" : "ascending") : undefined}
      >
        <button
          type="button"
          onClick={() => sortBy(key)}
          className={cn(
            "inline-flex items-center gap-1 hover:text-foreground",
            active ? "font-semibold text-foreground" : "text-muted-foreground",
          )}
        >
          {label}
          {active && <span aria-hidden>{sort.descending ? "↓" : "↑"}</span>}
        </button>
      </TableHead>
    );
  };

  const cells = (row: RecapRow) => (
    <>
      {COLUMNS.map((column) => (
        <TableCell
          key={column.key}
          className={cn("text-right font-mono", row[column.key] === 0 && "text-muted-foreground")}
        >
          {formatNumber(row[column.key])}
        </TableCell>
      ))}
      <TableCell className="pr-4 whitespace-nowrap">
        {row.last === null ? <span className="text-muted-foreground">—</span> : formatDateTime(new Date(row.last))}
      </TableCell>
    </>
  );

  const link = (pseudo: string, requester: string) => (
    <button
      type="button"
      onClick={() => onShowHistory(requester)}
      className="font-semibold text-primary hover:underline"
      aria-label={`Voir l'Historique : ${pseudo}`}
    >
      {pseudo}
    </button>
  );

  return (
    <Panel
      title="Récapitulatif (90 derniers jours)"
      aside={
        <span className="text-xs text-muted-foreground">
          {formatNumber(recap.alliance.total)} Demande{recap.alliance.total > 1 ? "s" : ""} · {formatNumber(requesters)}{" "}
          demandeur{requesters > 1 ? "s" : ""} sur {formatNumber(members.length)} membre
          {members.length > 1 ? "s" : ""}
        </span>
      }
      flush
    >
      <div className="overflow-x-auto">
        <Table className="text-[0.8125rem]">
          <TableHeader>
            <TableRow className="border-b-0 text-xs hover:bg-transparent">
              {header("pseudo", "Membre", "pl-4")}
              {COLUMNS.map((column) => header(column.key, column.label, "text-right"))}
              {header("last", "Dernière", "pr-4")}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.playerId} className="border-t border-b-0">
                <TableCell className="pl-4">{link(row.pseudo, row.pseudo)}</TableCell>
                {cells(row)}
              </TableRow>
            ))}
            {recap.former && (
              <TableRow className="border-t border-b-0">
                <TableCell className="pl-4">{link(recap.former.pseudo, FORMER_MEMBER)}</TableCell>
                {cells(recap.former)}
              </TableRow>
            )}
          </TableBody>
          <TableFooter>
            <TableRow className="font-semibold">
              <TableCell className="pl-4">Alliance</TableCell>
              {cells(recap.alliance)}
            </TableRow>
          </TableFooter>
        </Table>
      </div>
      <p className="px-4 py-3 text-xs text-muted-foreground">
        Les Demandes ouvertes et celles terminées dans les 90 derniers jours&nbsp;: le site efface une Demande terminée
        90 jours après. «&nbsp;Validées&nbsp;» compte celles validées en ce moment, couvertes comprises&nbsp;; une
        Demande close a pu être validée ou non. Un pseudo ouvre son Historique.
      </p>
    </Panel>
  );
}
