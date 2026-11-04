"use client";

// The « Historique » view of the Demandes tab (docs/features/site-demandes.md, « Récapitulatif et Historique »): the
// ended Demandes, filtered by state, requester and period, the most recently ended first; each unfolds the convoys
// attached to it or declared for it. A state is written in words (ADR 0003).
import { formatNumber } from "@optizzz/game/format/number-format";
import { formatDateTime } from "@optizzz/game/format/time-format";
import { STATUS_LABEL, type AttachedConvoy } from "@optizzz/game/site-links/demandes";
import { Fragment, useState } from "react";
import { Segmented } from "~/components/tools/hunt/hunt-parts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import type { OpenedDemande } from "~/lib/demandes/demandes";
import {
  convoysOf,
  filterHistory,
  HISTORY_PERIODS,
  historySummary,
  type HistoryFilter,
  type HistoryState,
} from "~/lib/demandes/recap";
import { FIELD_LABEL, Panel } from "./parts";

const STATES: readonly { value: HistoryState; label: string }[] = [
  { value: "all", label: "Toutes" },
  { value: "closed", label: "Closes" },
  { value: "cancelled", label: "Annulées" },
  { value: "refused", label: "Refusées" },
];
const PERIODS = HISTORY_PERIODS.map((days) => ({ value: days, label: `${String(days)} jours` }));

const plural = (count: number, word: string) => `${formatNumber(count)} ${word}${count > 1 ? "s" : ""}`;

/** « 12 Demandes · 8 closes, 3 annulées, 1 refusée ». */
function summaryText(shown: readonly OpenedDemande[]): string {
  const summary = historySummary(shown);
  const parts = [
    summary.closed > 0 && plural(summary.closed, "close"),
    summary.cancelled > 0 && plural(summary.cancelled, "annulée"),
    summary.refused > 0 && plural(summary.refused, "refusée"),
  ].filter((part) => part !== false);
  return [plural(summary.total, "Demande"), parts.join(", ")].filter(Boolean).join(" · ");
}

const amount = (d: OpenedDemande) => d.content.cost.food + d.content.cost.materials;
const sent = (d: OpenedDemande) =>
  d.progress.received.food + d.progress.received.materials + d.progress.onWay.food + d.progress.onWay.materials;

export function DemandesHistoryView({
  demandes,
  convoys,
  requesters,
  filter,
  onFilter,
  now,
}: {
  demandes: readonly OpenedDemande[];
  /** The convoys attached to a Demande or declared for it, as the page opened them. */
  convoys: readonly AttachedConvoy[];
  /** Who may be picked: the members, and « un ancien membre » when one has a Demande. */
  requesters: readonly string[];
  filter: HistoryFilter;
  onFilter: (next: Partial<HistoryFilter>) => void;
  now: Date;
}) {
  const [unfolded, setUnfolded] = useState<string | null>(null);
  const shown = filterHistory(demandes, filter, now);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="space-y-1">
          <span className={FIELD_LABEL}>État</span>
          <Segmented label="État" options={STATES} value={filter.state} onChange={(state) => onFilter({ state })} />
        </div>
        <label className="space-y-1">
          <span className={FIELD_LABEL}>Demandeur</span>
          <select
            className="block h-9 min-w-44 rounded-lg border bg-background px-2 text-sm"
            value={filter.requester ?? ""}
            onChange={(event) => onFilter({ requester: event.target.value || null })}
          >
            <option value="">Tous</option>
            {requesters.map((pseudo) => (
              <option key={pseudo} value={pseudo}>
                {pseudo}
              </option>
            ))}
          </select>
        </label>
        <div className="space-y-1">
          <span className={FIELD_LABEL}>Période</span>
          <Segmented label="Période" options={PERIODS} value={filter.days} onChange={(days) => onFilter({ days })} />
        </div>
      </div>

      <Panel
        title="Historique"
        aside={<span className="text-xs text-muted-foreground">la plus récemment finie d&apos;abord</span>}
        flush
      >
        <p className="px-4 pt-1 pb-2">{summaryText(shown)}</p>
        {shown.length === 0 ? (
          <p className="border-t px-4 py-3 text-muted-foreground">Aucune Demande terminée ne correspond.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table className="text-[0.8125rem]">
              <TableHeader>
                <TableRow className="border-b-0 text-xs hover:bg-transparent">
                  <TableHead className="pl-4">Demandeur</TableHead>
                  <TableHead>Demande</TableHead>
                  <TableHead className="text-right">Reçu sur le coût</TableHead>
                  <TableHead>État</TableHead>
                  <TableHead className="pr-4">Finie le</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((d) => {
                  const own = convoysOf(d, convoys);
                  const open = unfolded === d.id;
                  return (
                    <Fragment key={d.id}>
                      <TableRow className="border-t border-b-0">
                        <TableCell className="pl-4 align-top font-semibold">{d.requester}</TableCell>
                        <TableCell className="min-w-32 align-top whitespace-normal">{d.label}</TableCell>
                        <TableCell className="text-right align-top whitespace-nowrap">
                          {d.content.self ? (
                            <span className="text-muted-foreground">autofinancée</span>
                          ) : (
                            <span className="font-mono">
                              {formatNumber(sent(d))} / {formatNumber(amount(d))}
                            </span>
                          )}
                          {own.length > 0 && (
                            <button
                              type="button"
                              aria-expanded={open}
                              onClick={() => setUnfolded(open ? null : d.id)}
                              className="block w-full text-right text-xs font-semibold text-primary hover:underline"
                            >
                              {plural(own.length, "convoi")} · {open ? "Masquer" : "Afficher"}
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          {STATUS_LABEL[d.status]}
                          {(d.stored === "refused" || d.stored === "closed") && d.decidedByPseudo
                            ? ` par ${d.decidedByPseudo}`
                            : ""}
                        </TableCell>
                        <TableCell className="pr-4 align-top whitespace-nowrap">
                          {d.endedAt ? formatDateTime(new Date(d.endedAt)) : "—"}
                        </TableCell>
                      </TableRow>
                      {open && (
                        <TableRow className="border-b-0 hover:bg-transparent">
                          <TableCell colSpan={5} className="px-4 pt-0 pb-3 sm:pl-8">
                            <ConvoyTable demande={d} convoys={own} />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="px-4 py-3 text-xs text-muted-foreground">
          «&nbsp;Reçu&nbsp;» additionne les convois rattachés (lancés depuis «&nbsp;Envoyer un convoi&nbsp;») et
          déclarés pour la Demande. Une Demande terminée est effacée 90 jours après&nbsp;; ses convois, 90 jours après
          leur arrivée. Tous les convois de l&apos;alliance sont dans l&apos;onglet Convois.
        </p>
      </Panel>
    </div>
  );
}

function ConvoyTable({ demande, convoys }: { demande: OpenedDemande; convoys: readonly AttachedConvoy[] }) {
  return (
    <div className="overflow-x-auto rounded-lg bg-raised">
      <Table className="text-xs">
        <caption className="caption-top px-3 pt-2 pb-1 text-left font-medium text-muted-foreground">
          Convois pour {demande.label}
        </caption>
        <TableHeader>
          <TableRow className="border-b-0 hover:bg-transparent">
            <TableHead className="h-7 pl-3">De</TableHead>
            <TableHead className="h-7 text-right">Nourriture</TableHead>
            <TableHead className="h-7 text-right">Matériaux</TableHead>
            <TableHead className="h-7">Arrivée</TableHead>
            <TableHead className="h-7 pr-3">Compté</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {convoys.map((c) => (
            <TableRow
              key={`${c.from}-${String(c.at)}-${String(c.food)}-${String(c.materials)}`}
              className="border-t border-b-0"
            >
              <TableCell className="py-1.5 pl-3">{c.from}</TableCell>
              <TableCell className="py-1.5 text-right font-mono">{formatNumber(c.food)}</TableCell>
              <TableCell className="py-1.5 text-right font-mono">{formatNumber(c.materials)}</TableCell>
              <TableCell className="py-1.5 whitespace-nowrap">{formatDateTime(new Date(c.at))}</TableCell>
              <TableCell className="py-1.5 pr-3">{c.declared ? "déclaré" : "rattaché"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
