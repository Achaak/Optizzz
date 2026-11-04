// The Équilibre of the « Convois » tab (docs/features/site-envois.md, « Équilibre des ressources »; GLOSSARY.md, Part
// and Écart): who should convoy and who should receive over a period. Each day, the members of the space present in
// the alliance share its production evenly (their Part); what each has left (production, colony taxes, convoys) less
// their Part is their Écart. Worked out in this browser from the convoys opened for the tab and the members' daily
// TDC (public export); the site learns nothing more. Shared with the day-by-day table and the « in / out » chart.
import { formatCompact, formatDecimal } from "@optizzz/game/format/number-format";
import { dayMonth, fromParisParts } from "@optizzz/game/format/time-format";
import { HARVESTS_PER_DAY } from "@optizzz/game/forecast";
import type { SharedState } from "@optizzz/game/sharing/shared-state";
import type { ConvoyItem } from "@optizzz/game/site-links/envoi-convoys";
import { listNames, parisMidnight } from "./convoy-stats";

const DAY = 24 * 3600_000;

/** « Équilibré » within this share of the Part. */
export const BALANCED_WITHIN = 0.05;

/** The tax a colonizer takes at least: 20 %, plus 1 % per level of their Étable à pucerons. */
export const MIN_TAX_RATE = 0.2;

/** A stock older than this gives no Entrepôt estimé. */
export const STOCK_KEPT_MS = 48 * 3600_000;

/** A player on one Paris day, from that day's nightly export (`PlayerDay`). */
export interface PlayerDayRow {
  /** Midnight in Paris. */
  day: number;
  /** Hunting field (TDC), cm². */
  field: number;
  alliance: string | null;
}

/** A member of the space, or a colony of one: their days, and who colonizes them now (export). */
export interface BalancePlayer {
  pseudo: string;
  master: string | null;
  days: readonly PlayerDayRow[];
}

interface Resources {
  food: number;
  materials: number;
}

/** What a member's Entrepôt estimé starts from: their last stock, what they make a day, their capacities. */
export interface WarehouseInput {
  stock: Resources & { at: number };
  /** Harvest and mushroom farm a day, net of the colonizer's tax. */
  perDay: Resources;
  capacities: Resources | null;
}

export interface BalanceInput {
  /** The space's alliance tag. */
  tag: string;
  /** The pseudos of the space's members now. */
  members: readonly string[];
  /** The members who send their Convois. */
  senders: readonly string[];
  /** The members and the players they colonize, as the export shows them day by day. */
  players: readonly BalancePlayer[];
  /** As the Convois circuit opened them, one per fingerprint. */
  convoys: readonly ConvoyItem[];
  /** The colony tax rates known, by the colonized player's pseudo in lower case; 20 % otherwise. */
  taxRates?: Readonly<Record<string, number>>;
  /** The members' warehouses, by pseudo in lower case. */
  warehouses?: Readonly<Record<string, WarehouseInput>>;
  /** How many Paris days, today included. */
  days: number;
  now: Date;
}

export type Verdict = "convoy" | "balanced" | "receive";

/** A member's day: what they produced, their Part, their convoys. */
export interface BalanceDay {
  start: number;
  /** « 26/10 ». */
  label: string;
  /** In the space's alliance that day, by the export. */
  present: boolean;
  production: number;
  part: number;
  /** Taxes received less taxes paid. */
  taxes: number;
  sent: number;
  received: number;
}

export interface BalanceRow {
  pseudo: string;
  /** The TDC of the last day known, null when the export does not know the member. */
  field: number | null;
  /** Their ceiling: TDC × 48 each day they are present. */
  production: number;
  taxes: { paid: number; received: number; estimated: boolean };
  sent: number;
  received: number;
  /** Production, taxes and convoys. */
  net: number;
  part: number;
  /** Net less Part: positive, they have enough to convoy. */
  gap: number;
  /** Net divided by Part, null without a Part. */
  ratio: number | null;
  /** Null when they do not send their Convois (`partial`) or have no Part. */
  verdict: Verdict | null;
  /** Does not send their Convois: only what they exchange with those who send counts. */
  partial: boolean;
  /** A maximum (spending is unknown); null without a stock of less than 48 hours. */
  warehouse: (Resources & { capped: boolean }) | null;
  daily: BalanceDay[];
}

export interface Balance {
  /** Midnight in Paris, the first day of the period. */
  since: number;
  /** The members' production, each day they are present. */
  production: number;
  /** The Part a day of a member present, on average over the period. */
  partPerDay: number;
  /** By gap, the biggest first; those without a verdict last. */
  rows: BalanceRow[];
  counts: Record<Verdict | "unknown", number>;
  coverage: { members: number; senders: number; missing: string[] };
}

/** The players as the site serves them, each day (« 2026-11-02 ») as its midnight in Paris. */
export function balancePlayers(
  served: readonly {
    pseudo: string;
    master: string | null;
    days: readonly { day: string; field: number; alliance: string | null }[];
  }[],
): BalancePlayer[] {
  return served.map((player) => ({
    pseudo: player.pseudo,
    master: player.master,
    days: player.days.map((row) => {
      const [year = 0, month = 0, day = 0] = row.day.split("-").map(Number);
      return {
        day: fromParisParts({ year, month, day, hours: 0, minutes: 0 }).getTime(),
        field: row.field,
        alliance: row.alliance,
      };
    }),
  }));
}

const key = (pseudo: string) => pseudo.toLowerCase();
const amount = (c: Resources) => c.food + c.materials;

/** The export's row of `day`, or of the last day before it: a day missing from the export keeps the last known. */
function rowOn(days: readonly PlayerDayRow[], day: number): PlayerDayRow | null {
  let found: PlayerDayRow | null = null;
  for (const row of days) if (row.day <= day && (!found || row.day > found.day)) found = row;
  return found;
}

export function balanceOf(input: BalanceInput): Balance {
  const now = input.now.getTime();
  const tag = key(input.tag);
  const since = parisMidnight(input.now, input.days - 1);
  const starts = Array.from({ length: input.days }, (_, i) => parisMidnight(input.now, input.days - 1 - i));
  // Today counts as far as it went.
  const weights = starts.map((start, i) => (i === starts.length - 1 ? Math.min(1, (now - start) / DAY) : 1));
  const players = new Map(input.players.map((p) => [key(p.pseudo), p]));
  const senders = new Set(input.senders.map(key));

  /** Each day, a player's ceiling and whether they were in the alliance. */
  const daysOf = (pseudo: string) => {
    const player = players.get(key(pseudo));
    return starts.map((start, i) => {
      const row = player ? rowOn(player.days, start) : null;
      return {
        present: row !== null && row.alliance !== null && key(row.alliance) === tag,
        ceiling: row ? row.field * HARVESTS_PER_DAY * (weights[i] ?? 0) : 0,
      };
    });
  };
  const memberDays = new Map(input.members.map((m) => [key(m), daysOf(m)]));
  const shares = starts.map((_, i) => {
    let total = 0;
    let present = 0;
    for (const days of memberDays.values()) {
      const day = days[i];
      if (!day?.present) continue;
      total += day.ceiling;
      present += 1;
    }
    return { total, share: present > 0 ? total / present : 0 };
  });

  const rows = input.members.map((pseudo): BalanceRow => {
    const k = key(pseudo);
    const days = memberDays.get(k) ?? [];
    const player = players.get(k);
    const last = player?.days.reduce<PlayerDayRow | null>((a, b) => (!a || b.day > a.day ? b : a), null);
    // A rate supposed at 20 %, set by `rateOf`.
    const supposed = { any: false };
    const rateOf = (colonized: string) => {
      const known = input.taxRates?.[key(colonized)];
      if (known !== undefined) return known;
      supposed.any = true;
      return MIN_TAX_RATE;
    };
    const colonies = input.players.filter((p) => p.master !== null && key(p.master) === k);
    let paid = 0;
    let gotten = 0;
    const daily = starts.map((start, i): BalanceDay => {
      const day = days[i] ?? { present: false, ceiling: 0 };
      const label = dayMonth(new Date(start));
      if (!day.present) return { start, label, present: false, production: 0, part: 0, taxes: 0, sent: 0, received: 0 };
      const out = player?.master ? day.ceiling * rateOf(pseudo) : 0;
      const into = colonies.reduce(
        (total, colony) => total + (daysOf(colony.pseudo)[i]?.ceiling ?? 0) * rateOf(colony.pseudo),
        0,
      );
      paid += out;
      gotten += into;
      const part = shares[i]?.share ?? 0;
      return { start, label, present: true, production: day.ceiling, part, taxes: into - out, sent: 0, received: 0 };
    });
    for (const convoy of input.convoys) {
      if (convoy.kind !== "delivered" || convoy.at < since || convoy.at > now) continue;
      if (key(convoy.from) === key(convoy.to)) continue;
      const day = daily.findLast((d) => d.start <= convoy.at);
      if (!day) continue;
      if (key(convoy.from) === k) day.sent += amount(convoy);
      else if (key(convoy.to) === k) day.received += amount(convoy);
    }
    const sum = (pick: (d: BalanceDay) => number) => daily.reduce((total, d) => total + pick(d), 0);
    const production = sum((d) => d.production);
    const sent = sum((d) => d.sent);
    const received = sum((d) => d.received);
    const part = sum((d) => d.part);
    const net = production - paid + gotten - sent + received;
    const gap = net - part;
    const partial = !senders.has(k);
    const verdict =
      partial || part <= 0
        ? null
        : Math.abs(gap) <= BALANCED_WITHIN * part
          ? "balanced"
          : gap > 0
            ? "convoy"
            : "receive";
    return {
      pseudo,
      field: last?.field ?? null,
      production,
      taxes: { paid, received: gotten, estimated: supposed.any && (paid > 0 || gotten > 0) },
      sent,
      received,
      net,
      part,
      gap,
      ratio: part > 0 ? net / part : null,
      verdict,
      partial,
      warehouse: warehouseOf(pseudo, input.warehouses?.[k], input.convoys, now),
      daily,
    };
  });

  const missing = input.members.filter((m) => !senders.has(key(m)));
  const presentDays = [...memberDays.values()].reduce(
    (count, days) => count + days.reduce((n, d, i) => n + (d.present ? (weights[i] ?? 0) : 0), 0),
    0,
  );
  const production = shares.reduce((total, s) => total + s.total, 0);
  const counts = { convoy: 0, balanced: 0, receive: 0, unknown: 0 };
  for (const r of rows) counts[r.verdict ?? "unknown"] += 1;
  return {
    since,
    production,
    partPerDay: presentDays > 0 ? production / presentDays : 0,
    rows: rows.sort(
      (a, b) =>
        Number(a.verdict === null) - Number(b.verdict === null) || b.gap - a.gap || a.pseudo.localeCompare(b.pseudo),
    ),
    counts,
    coverage: {
      members: input.members.length,
      senders: input.members.length - missing.length,
      missing,
    },
  };
}

/**
 * The Entrepôt estimé: the last stock, plus what was made since, less the convoys gone since (on their way too),
 * plus those come; bounded by the capacities when known. A convoy counts by its arrival: its departure is not known.
 */
function warehouseOf(
  pseudo: string,
  warehouse: WarehouseInput | undefined,
  convoys: readonly ConvoyItem[],
  now: number,
): BalanceRow["warehouse"] {
  if (!warehouse || now - warehouse.stock.at >= STOCK_KEPT_MS) return null;
  const k = key(pseudo);
  const elapsed = Math.max(0, now - warehouse.stock.at) / DAY;
  const content = {
    food: warehouse.stock.food + warehouse.perDay.food * elapsed,
    materials: warehouse.stock.materials + warehouse.perDay.materials * elapsed,
  };
  for (const convoy of convoys) {
    if (convoy.at <= warehouse.stock.at || key(convoy.from) === key(convoy.to)) continue;
    if (key(convoy.from) === k) {
      content.food -= convoy.food;
      content.materials -= convoy.materials;
    } else if (key(convoy.to) === k && convoy.kind === "delivered" && convoy.at <= now) {
      content.food += convoy.food;
      content.materials += convoy.materials;
    }
  }
  const bound = (value: number, capacity: number | undefined) =>
    Math.round(Math.max(0, Math.min(value, capacity ?? Infinity)));
  return {
    food: bound(content.food, warehouse.capacities?.food),
    materials: bound(content.materials, warehouse.capacities?.materials),
    capped: warehouse.capacities !== null,
  };
}

/**
 * The colony tax rates known, by the colonized player's pseudo in lower case: the one their Production says, else
 * 20 % + 1 % per level of their colonizer's Étable à pucerons when the colonizer's levels say it.
 */
export function taxRatesOf(
  states: readonly Pick<SharedState, "pseudo" | "production" | "buildings">[],
  players: readonly BalancePlayer[],
): Record<string, number> {
  const rates: Record<string, number> = {};
  for (const player of players) {
    if (player.master === null) continue;
    const own = states.find((s) => key(s.pseudo) === key(player.pseudo))?.production;
    const aphids = states.find((s) => key(s.pseudo) === key(player.master ?? ""))?.buildings?.aphids;
    if (own) rates[key(player.pseudo)] = own.taxRate;
    else if (aphids !== undefined) rates[key(player.pseudo)] = MIN_TAX_RATE + aphids / 100;
  }
  return rates;
}

/** What a member's Entrepôt estimé starts from, in their shared state; null without a stock or a Production. */
export function warehouseInputOf(state: SharedState): WarehouseInput | null {
  const { stock, production } = state;
  if (!stock || !production) return null;
  const kept = 1 - production.taxRate;
  return {
    stock: { food: stock.food, materials: stock.materials, at: stock.at.getTime() },
    perDay: {
      food: (production.foodWorkers * HARVESTS_PER_DAY + production.mushroomPerDay) * kept,
      materials: production.materialWorkers * HARVESTS_PER_DAY * kept,
    },
    capacities: state.capacities ?? null,
  };
}

/** « Convoyer », « Équilibré », « Recevoir »; « Partiel » without a verdict. */
export function verdictText(verdict: Verdict | null): string {
  return verdict === null ? "Partiel" : { convoy: "Convoyer", balanced: "Équilibré", receive: "Recevoir" }[verdict];
}

/** Under a requester's Priorité: « Équilibre : recevoir (−1,1M sur 30 jours) », « Équilibre : partiel ». */
export function balanceLine(row: BalanceRow, days: number): string {
  if (row.verdict === null) return "Équilibre : partiel";
  return `Équilibre : ${verdictText(row.verdict).toLowerCase()} (${signedCompact(row.gap)} sur ${String(days)} jours)`;
}

/** « +72K », « −1,2M », « 0 ». */
export function signedCompact(value: number): string {
  const sign = Math.round(value) > 0 ? "+" : Math.round(value) < 0 ? "−" : "";
  return `${sign}${formatCompact(Math.abs(value))}`;
}

/**
 * The Équilibre as a message to paste in the alliance's Discord: copied, never sent by Optizzz. Never the warehouses:
 * a Discord channel is read more widely than the space.
 */
export function balanceDiscord(balance: Balance, context: { tag: string; days: number; now: Date }): string {
  const { missing } = balance.coverage;
  return [
    `**Équilibre ${context.tag} · ${String(context.days)} jours** (du ${dayMonth(new Date(balance.since))} au ${dayMonth(context.now)})`,
    `Production : ${formatCompact(balance.production)} · part par jour : ${formatCompact(balance.partPerDay)}`,
    ...balance.rows
      .filter((row) => row.verdict !== null)
      .map(
        (row) =>
          `- ${row.pseudo} : ${verdictText(row.verdict).toLowerCase()} · écart ${signedCompact(row.gap)}` +
          (row.ratio === null ? "" : ` (ratio ${formatDecimal(row.ratio)})`),
      ),
    ...(missing.length === 0
      ? []
      : [
          `(${listNames(missing)} ${missing.length > 1 ? "n'envoient pas leurs" : "n'envoie pas ses"} convois : pas de verdict)`,
        ]),
  ].join("\n");
}
