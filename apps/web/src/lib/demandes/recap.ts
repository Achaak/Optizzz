// The « Récapitulatif » and « Historique » views of the Demandes tab (docs/features/site-demandes.md, « Récapitulatif
// et Historique »): each member's Demandes counted by status, the ended ones filtered, their convoys; and the tab's
// view kept in the address so that a link opens it the same (`?onglet=demandes&vue=historique&etat=refusees`).
// Only what the site keeps counts: the open Demandes and those ended in the last 90 days, by their status now.
import type { DemandeConvoy, DemandeStatus } from "@optizzz/game/site-links/demandes";

const DAY_MS = 86_400_000;
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

interface CountedDemande {
  playerId: number;
  stored: DemandeStatus;
  createdAt: number;
}

export interface RecapRow {
  playerId: number | null;
  pseudo: string;
  total: number;
  pending: number;
  /** Validated now, covered ones included: the site does not keep whether an ended Demande was validated. */
  validated: number;
  closed: number;
  cancelled: number;
  refused: number;
  /** When the newest was made; null without a Demande. */
  last: number | null;
}

const emptyRow = (playerId: number | null, pseudo: string): RecapRow => ({
  playerId,
  pseudo,
  total: 0,
  pending: 0,
  validated: 0,
  closed: 0,
  cancelled: 0,
  refused: 0,
  last: null,
});

function count(row: RecapRow, demande: CountedDemande): void {
  row.total += 1;
  row[demande.stored] += 1;
  row.last = Math.max(row.last ?? 0, demande.createdAt);
}

/**
 * One line per member, those without a Demande too; the former members' Demandes on one line of their own (null
 * without any), and the alliance's total.
 */
export function demandesRecap(
  demandes: readonly CountedDemande[],
  members: readonly { playerId: number; pseudo: string }[],
): { rows: RecapRow[]; former: RecapRow | null; alliance: RecapRow } {
  const rows = new Map(members.map((m) => [m.playerId, emptyRow(m.playerId, m.pseudo)]));
  const former = emptyRow(null, "Anciens membres");
  const alliance = emptyRow(null, "Alliance");
  for (const demande of demandes) {
    count(rows.get(demande.playerId) ?? former, demande);
    count(alliance, demande);
  }
  return { rows: [...rows.values()], former: former.total > 0 ? former : null, alliance };
}

export type RecapKey = "pseudo" | "total" | "pending" | "validated" | "closed" | "cancelled" | "refused" | "last";
export interface RecapSort {
  key: RecapKey;
  descending: boolean;
}
export const DEFAULT_RECAP_SORT: RecapSort = { key: "total", descending: true };

/** By the column asked, then by pseudo; a member without a Demande last by date, whichever way. */
export function sortRecap(rows: readonly RecapRow[], sort: RecapSort): RecapRow[] {
  const byPseudo = (a: RecapRow, b: RecapRow) => a.pseudo.localeCompare(b.pseudo, "fr", { sensitivity: "base" });
  const sign = sort.descending ? -1 : 1;
  return [...rows].sort((a, b) => {
    if (sort.key === "pseudo") return sign * byPseudo(a, b);
    if (sort.key === "last" && (a.last === null || b.last === null))
      return (a.last === null ? 1 : 0) - (b.last === null ? 1 : 0) || byPseudo(a, b);
    return sign * ((a[sort.key] ?? 0) - (b[sort.key] ?? 0)) || byPseudo(a, b);
  });
}

export type HistoryState = "all" | "closed" | "cancelled" | "refused";
export const HISTORY_PERIODS = [7, 30, 90] as const;
export type HistoryPeriod = (typeof HISTORY_PERIODS)[number];

export interface HistoryFilter {
  state: HistoryState;
  /** A requester's pseudo, as the tab writes it (« un ancien membre » too); null for all. */
  requester: string | null;
  days: HistoryPeriod;
}

interface EndedDemande {
  stored: DemandeStatus;
  requester: string;
  endedAt: number | null;
}

const ENDED: readonly DemandeStatus[] = ["closed", "cancelled", "refused"];

/** The ended Demandes the filter keeps, the most recently ended first. */
export function filterHistory<D extends EndedDemande>(demandes: readonly D[], filter: HistoryFilter, now: Date): D[] {
  const since = now.getTime() - filter.days * DAY_MS;
  return demandes
    .filter(
      (d) =>
        ENDED.includes(d.stored) &&
        (filter.state === "all" || d.stored === filter.state) &&
        (filter.requester === null || same(d.requester, filter.requester)) &&
        (d.endedAt ?? 0) >= since,
    )
    .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0));
}

/** How many Demandes the Historique shows, by state. */
export function historySummary(demandes: readonly { stored: DemandeStatus }[]) {
  const of = (status: DemandeStatus) => demandes.filter((d) => d.stored === status).length;
  return { total: demandes.length, closed: of("closed"), cancelled: of("cancelled"), refused: of("refused") };
}

/** The convoys attached to or declared for a Demande, toward its requester (as its progress counts them), earliest first. */
export function convoysOf<C extends DemandeConvoy>(
  demande: { id: string; requester: string },
  convoys: readonly C[],
): C[] {
  return convoys.filter((c) => c.demande === demande.id && same(c.to, demande.requester)).sort((a, b) => a.at - b.at);
}

// ── The view in the address

export interface DemandesView extends HistoryFilter {
  view: "demandes" | "recap" | "history";
}

export const DEFAULT_DEMANDES_VIEW: DemandesView = { view: "demandes", state: "all", requester: null, days: 90 };

/** The value of `onglet` that opens the « Demandes » tab. */
export const DEMANDES_TAB = "demandes";

const VIEW_WORDS = { recap: "recapitulatif", history: "historique" } as const;
const STATE_WORDS = { closed: "closes", cancelled: "annulees", refused: "refusees" } as const;

export function readDemandesView(
  params: { get: (name: string) => string | null },
  requesters: readonly string[],
): DemandesView {
  const word = <K extends string>(words: Record<K, string>, value: string | null): K | undefined =>
    (Object.keys(words) as K[]).find((key) => words[key] === value);
  const wanted = params.get("membre");
  return {
    view: word(VIEW_WORDS, params.get("vue")) ?? DEFAULT_DEMANDES_VIEW.view,
    state: word(STATE_WORDS, params.get("etat")) ?? DEFAULT_DEMANDES_VIEW.state,
    requester: wanted === null ? null : (requesters.find((r) => same(r, wanted)) ?? null),
    days: HISTORY_PERIODS.find((days) => String(days) === params.get("periode")) ?? DEFAULT_DEMANDES_VIEW.days,
  };
}

/** The address of a view: only what differs from the default, the Historique's filters on the Historique only. */
export function demandesViewSearch(view: DemandesView): string {
  const params = new URLSearchParams({ onglet: DEMANDES_TAB });
  if (view.view !== "demandes") params.set("vue", VIEW_WORDS[view.view]);
  if (view.view === "history") {
    if (view.state !== "all") params.set("etat", STATE_WORDS[view.state]);
    if (view.requester !== null) params.set("membre", view.requester);
    if (view.days !== DEFAULT_DEMANDES_VIEW.days) params.set("periode", String(view.days));
  }
  return params.toString();
}
