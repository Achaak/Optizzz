// The statistics of the « Convois » tab (docs/features/site-envois.md, « Statistiques des convois »): worked out in
// this browser from the convoys the tab opened, one per fingerprint. A convoy counts once it is delivered, at its
// delivery; one on its way has its own figures. The site never sees any of it.
import { formatCompact, formatNumber } from "@optizzz/game/format/number-format";
import { dayMonth, fromParisParts, parisParts } from "@optizzz/game/format/time-format";
import type { DemandeConvoy } from "@optizzz/game/site-links/demandes";
import type { ConvoyItem } from "@optizzz/game/site-links/envoi-convoys";

export const PERIODS = [7, 30, 90] as const;
export type Period = (typeof PERIODS)[number];

export interface ConvoyStatsInput {
  /** As the Convois circuit opened them, one per fingerprint. */
  convoys: readonly ConvoyItem[];
  /** The convoys attached to a Demande. */
  demandeConvoys: readonly DemandeConvoy[];
  /** The pseudos of the space's members now. */
  members: readonly string[];
  /** The members who send their Convois. */
  senders: readonly string[];
  days: Period;
  /** A member's pseudo: their convoys only. */
  member: string | null;
  now: Date;
}

interface Resources {
  food: number;
  materials: number;
}

/** A player's convoys over the period, food and materials added. */
export interface PlayerRow {
  player: string;
  /** A member of the space now. */
  member: boolean;
  /** A member who does not send their Convois: only what they exchange with those who send counts. */
  partial: boolean;
  delivered: number;
  received: number;
  /** Received less delivered, as the Priorité's Solde. */
  solde: number;
  count: number;
  /** The newest delivery, null without one. */
  last: number | null;
}

export interface ConvoyStats {
  /** Midnight in Paris, the first day of the period. */
  since: number;
  delivered: Resources & { count: number };
  /** The chosen member's own figures, null for the whole alliance. */
  self: PlayerRow | null;
  /**
   * « Par membre »: every member, most delivered first, those without a convoy last. With a member chosen, « Avec
   * qui »: each player they exchanged with, member or not, delivered and received from the chosen member's side.
   */
  rows: PlayerRow[];
  /** The biggest flows between two members, each way on its own line. */
  flows: Flow[];
  /** The share of the delivered between two members, null without a convoy. */
  betweenMembers: number | null;
  /** « Hors alliance »: to other players, from other players. */
  outside: { sent: OutsideWay; received: OutsideWay };
  /** The convoys on their way now (one whose arrival passed waits for its delivery), the 3 soonest in `next`. */
  onWay: Resources & { count: number; next: ConvoyItem[] };
  /** How many members send their Convois, and the others by name. */
  coverage: { members: number; senders: number; missing: string[] };
  /** The oldest delivery known, when the period starts before it: older convoys may be missing. */
  knownSince: number | null;
  /**
   * Roughly what went to the Demandes: the attached convoys whose arrival is in the period. Read on their way, not
   * delivered: hence « environ ».
   */
  forDemandes: { amount: number; demandes: number };
  /** « Livré par jour »: every day of the period, by week over 90 days. */
  buckets: Bucket[];
}

/** Convoys one way between a member and another player. */
export interface OutsideWay {
  total: number;
  /** The biggest other players. */
  top: { player: string; amount: number }[];
  /** How many other players beyond those. */
  others: number;
}

/** A day of the chart (a week over 90 days), from midnight in Paris. */
export interface Bucket extends Resources {
  start: number;
  /** « 26/10 »: the first day. */
  label: string;
  /** With a member chosen: what they delivered, and received. */
  sent: number;
  received: number;
}

interface Flow {
  from: string;
  to: string;
  amount: number;
  count: number;
}

const FLOWS_SHOWN = 8;
const NEXT_SHOWN = 3;
const OUTSIDE_SHOWN = 3;

function outsideWay(amounts: Map<string, { player: string; amount: number }>): OutsideWay {
  const sorted = [...amounts.values()].sort((a, b) => b.amount - a.amount || a.player.localeCompare(b.player));
  return {
    total: sorted.reduce((sum, entry) => sum + entry.amount, 0),
    top: sorted.slice(0, OUTSIDE_SHOWN),
    others: Math.max(0, sorted.length - OUTSIDE_SHOWN),
  };
}

const key = (pseudo: string) => pseudo.toLowerCase();
const amount = (c: Resources) => c.food + c.materials;

const byDelivered = (a: PlayerRow, b: PlayerRow) =>
  b.delivered - a.delivered || b.count - a.count || b.received - a.received || a.player.localeCompare(b.player);

/** Midnight in Paris, `back` days before today. */
function parisMidnight(now: Date, back: number): number {
  const { year, month, day } = parisParts(now);
  return fromParisParts({ year, month, day: day - back, hours: 0, minutes: 0 }).getTime();
}

export function convoyStats(input: ConvoyStatsInput): ConvoyStats {
  const now = input.now.getTime();
  const since = parisMidnight(input.now, input.days - 1);
  const members = new Map(input.members.map((m) => [key(m), m]));
  const senders = new Set(input.senders.map(key));
  const chosen = input.member === null ? null : key(input.member);
  const involves = (c: { from: string; to: string }) =>
    chosen === null || key(c.from) === chosen || key(c.to) === chosen;
  const inPeriod = input.convoys.filter(
    (c) => c.kind === "delivered" && c.at >= since && c.at <= now && key(c.from) !== key(c.to) && involves(c),
  );

  const newRows = () => {
    const rows = new Map<string, PlayerRow>();
    const rowOf = (pseudo: string) => {
      const k = key(pseudo);
      let row = rows.get(k);
      if (!row) {
        const member = members.get(k);
        row = {
          player: member ?? pseudo,
          member: member !== undefined,
          partial: member !== undefined && !senders.has(k),
          delivered: 0,
          received: 0,
          solde: 0,
          count: 0,
          last: null,
        };
        rows.set(k, row);
      }
      return row;
    };
    const add = (row: PlayerRow, convoy: ConvoyItem, way: "delivered" | "received") => {
      row[way] += amount(convoy);
      row.solde = row.received - row.delivered;
      row.count += 1;
      row.last = Math.max(row.last ?? 0, convoy.at);
    };
    return { rows, rowOf, add };
  };

  // Each player's own convoys; with a member chosen, theirs only.
  const players = newRows();
  for (const member of input.members) players.rowOf(member);
  for (const convoy of inPeriod) {
    players.add(players.rowOf(convoy.from), convoy, "delivered");
    players.add(players.rowOf(convoy.to), convoy, "received");
  }
  // « Avec qui »: the chosen member's convoys by the other player, from the member's side.
  const counterparts = newRows();
  if (chosen !== null)
    for (const convoy of inPeriod) {
      const sent = key(convoy.from) === chosen;
      counterparts.add(counterparts.rowOf(sent ? convoy.to : convoy.from), convoy, sent ? "delivered" : "received");
    }

  const flows = new Map<string, Flow>();
  let betweenMembers = 0;
  for (const convoy of inPeriod) {
    const from = members.get(key(convoy.from));
    const to = members.get(key(convoy.to));
    if (from === undefined || to === undefined) continue;
    betweenMembers += amount(convoy);
    const id = `${key(from)}>${key(to)}`;
    const flow = flows.get(id) ?? { from, to, amount: 0, count: 0 };
    flow.amount += amount(convoy);
    flow.count += 1;
    flows.set(id, flow);
  }

  const sentOut = new Map<string, { player: string; amount: number }>();
  const receivedOut = new Map<string, { player: string; amount: number }>();
  for (const convoy of inPeriod) {
    const fromMember = members.has(key(convoy.from));
    const toMember = members.has(key(convoy.to));
    if (fromMember === toMember) continue;
    const [into, other] = fromMember ? [sentOut, convoy.to] : [receivedOut, convoy.from];
    const entry = into.get(key(other)) ?? { player: other, amount: 0 };
    entry.amount += amount(convoy);
    into.set(key(other), entry);
  }

  const size = input.days === 90 ? 7 : 1;
  const buckets: Bucket[] = [];
  for (let back = input.days - 1; back >= 0; back -= size) {
    const start = parisMidnight(input.now, back);
    buckets.push({ start, label: dayMonth(new Date(start)), food: 0, materials: 0, sent: 0, received: 0 });
  }
  for (const convoy of inPeriod) {
    const bucket = buckets.findLast((b) => b.start <= convoy.at);
    if (!bucket) continue;
    bucket.food += convoy.food;
    bucket.materials += convoy.materials;
    if (chosen === null) continue;
    if (key(convoy.from) === chosen) bucket.sent += amount(convoy);
    else bucket.received += amount(convoy);
  }

  const onWay = input.convoys
    .filter((c) => c.kind === "transit" && c.at > now && involves(c))
    .sort((a, b) => a.at - b.at);
  const attached = input.demandeConvoys.filter((c) => c.at >= since && c.at <= now && involves(c));
  const oldest = Math.min(...input.convoys.filter((c) => c.kind === "delivered").map((c) => c.at));
  const missing = input.members.filter((m) => !senders.has(key(m)));
  const total = inPeriod.reduce((sum, c) => sum + amount(c), 0);

  return {
    since,
    delivered: {
      food: inPeriod.reduce((sum, c) => sum + c.food, 0),
      materials: inPeriod.reduce((sum, c) => sum + c.materials, 0),
      count: inPeriod.length,
    },
    self: chosen === null ? null : players.rowOf(input.member ?? ""),
    rows:
      chosen === null
        ? [...players.rows.values()].filter((row) => row.member).sort(byDelivered)
        : [...counterparts.rows.values()].sort(byDelivered),
    flows: [...flows.values()].sort((a, b) => b.amount - a.amount || b.count - a.count).slice(0, FLOWS_SHOWN),
    betweenMembers: total > 0 ? betweenMembers / total : null,
    onWay: {
      food: onWay.reduce((sum, c) => sum + c.food, 0),
      materials: onWay.reduce((sum, c) => sum + c.materials, 0),
      count: onWay.length,
      next: onWay.slice(0, NEXT_SHOWN),
    },
    buckets,
    forDemandes: {
      amount: attached.reduce((sum, c) => sum + amount(c), 0),
      demandes: new Set(attached.map((c) => c.demande)).size,
    },
    coverage: { members: input.members.length, senders: input.members.length - missing.length, missing },
    knownSince: Number.isFinite(oldest) && oldest > since ? oldest : null,
    outside: { sent: outsideWay(sentOut), received: outsideWay(receivedOut) },
  };
}

/** « Okapi », « Okapi et Grop », « Okapi, Grop et Lasius ». */
const listNames = (names: readonly string[]) =>
  names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} et ${names.at(-1) ?? ""}`;

/**
 * The statistics as a message to paste in the alliance's Discord: copied, never sent by Optizzz. Amounts as the game
 * shortens them; a member, or a player, without a convoy in the period is left out.
 */
export function convoyStatsDiscord(stats: ConvoyStats, context: { tag: string; days: Period; now: Date }): string {
  const period = `${String(context.days)} jours** (du ${dayMonth(new Date(stats.since))} au ${dayMonth(context.now)})`;
  const sum = stats.delivered.food + stats.delivered.materials;
  const convoys = `${formatNumber(stats.delivered.count)} convoi${stats.delivered.count > 1 ? "s" : ""}`;
  const shown = stats.rows.filter((row) => row.count > 0);
  if (stats.self) {
    const self = stats.self;
    return [
      `**Convois de ${self.player} (${context.tag}) · ${period}`,
      `Livré ${formatCompact(self.delivered)} · reçu ${formatCompact(self.received)} · solde ${formatCompact(self.solde)} · ${convoys}`,
      ...shown.map(
        (row) => `- avec ${row.player} : livré ${formatCompact(row.delivered)} · reçu ${formatCompact(row.received)}`,
      ),
    ].join("\n");
  }
  const { missing } = stats.coverage;
  return [
    `**Convois ${context.tag} · ${period}`,
    `Livré : ${formatCompact(sum)} (${formatCompact(stats.delivered.food)} nourriture · ${formatCompact(stats.delivered.materials)} matériaux) · ${convoys}`,
    ...shown.map(
      (row) =>
        `- ${row.player} : livré ${formatCompact(row.delivered)} · reçu ${formatCompact(row.received)} · solde ${formatCompact(row.solde)}`,
    ),
    ...(missing.length === 0
      ? []
      : [
          `(${listNames(missing)} ${missing.length > 1 ? "n'envoient pas leurs" : "n'envoie pas ses"} convois : seuls ceux échangés avec les autres membres comptent)`,
        ]),
  ].join("\n");
}
