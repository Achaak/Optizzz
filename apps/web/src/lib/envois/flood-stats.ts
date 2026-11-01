// The statistics of the « Floods » tab (docs/features/site-envois.md, « Statistiques des floods »): worked out in this
// browser from the floods the tab opened, one per fingerprint. A flood counts once arrived; one on its way has its own
// figures. The take is the one the Plan de flood expected, never the combat's: unknown for an attack launched without
// it, so a total is « at least ». The site keeps a flood 7 days after its arrival: no period goes further.
import type { FloodItem } from "@optizzz/game/site-links/envoi-floods";
import { formatCompact, formatNumber } from "@optizzz/game/format/number-format";
import { dayMonth, formatDateTime, parisParts } from "@optizzz/game/format/time-format";
import { listNames, parisMidnight } from "./convoy-stats";

export const FLOOD_PERIODS = ["24h", "7j"] as const;
export type FloodPeriod = (typeof FLOOD_PERIODS)[number];

const HOUR = 3600_000;

export interface FloodStatsInput {
  /** As the Floods circuit opened them, one per fingerprint; `army` only for an Admin. */
  floods: readonly (FloodItem & { army: Record<string, number> | null })[];
  /** The pseudos of the space's members now. */
  members: readonly string[];
  /** The members who send their Floods. */
  senders: readonly string[];
  period: FloodPeriod;
  /** A member's pseudo: their floods only. */
  member: string | null;
  now: Date;
}

/** A member's floods over the period. */
export interface MemberRow {
  player: string;
  /** Sends their Floods: otherwise none of their attacks is known. */
  sends: boolean;
  count: number;
  /** The known takes added; `withoutPlan` floods have none. */
  take: number;
  withoutPlan: number;
  /** How many players they hit. */
  targets: number;
  /** Their floods on their way now. */
  onWay: number;
  /** The latest arrival in the period, null without one. */
  last: number | null;
}

/** A player the members hit in the period. */
export interface TargetRow {
  target: string;
  count: number;
  take: number;
  withoutPlan: number;
  /** The members who hit them, the biggest take first. */
  by: string[];
  last: number;
}

/** An hour (over 24 hours) or a day of Paris (over 7 days) of the chart. */
export interface Bucket {
  start: number;
  /** « 13 h » or « 26/10 ». */
  label: string;
  count: number;
  take: number;
}

export interface FloodStats {
  /** Where the period starts: 24 hours ago, or midnight in Paris 6 days ago. */
  since: number;
  /** The floods arrived in the period; `take` adds the known takes, `withoutPlan` counts the unknown ones. */
  arrived: { count: number; take: number; withoutPlan: number };
  /** « Par membre »: the biggest take first, members without a flood then, those who do not send last. */
  rows: MemberRow[];
  /** The chosen member's own row, null for the whole alliance. */
  self: MemberRow | null;
  /** « Cibles les plus visées »: the 8 biggest takes. */
  targets: TargetRow[];
  /** How many players were hit, and how many of them by several members. */
  targetCount: { all: number; shared: number };
  /** The floods on their way now, the 3 soonest in `next`. */
  onWay: { count: number; next: FloodItem[] };
  /** How many members send their Floods, and the others by name. */
  coverage: { members: number; senders: number; missing: string[] };
  /**
   * The army sent with the floods arrived, by unit key, and how many floods it comes from (those of the Plan); null
   * when none is known, as for a member who is not an Admin.
   */
  army: { units: Record<string, number>; floods: number } | null;
  /** « Prise attendue par jour », by hour over 24 hours: every hour or day of the period. */
  buckets: Bucket[];
}

const TARGETS_SHOWN = 8;
const NEXT_SHOWN = 3;

const key = (pseudo: string) => pseudo.toLowerCase();

const byTake = (a: MemberRow, b: MemberRow) =>
  Number(b.sends) - Number(a.sends) ||
  b.take - a.take ||
  b.count - a.count ||
  b.onWay - a.onWay ||
  a.player.localeCompare(b.player);

export function floodStats(input: FloodStatsInput): FloodStats {
  const now = input.now.getTime();
  const since = input.period === "24h" ? now - 24 * HOUR : parisMidnight(input.now, 6);
  const chosen = input.member === null ? null : key(input.member);
  const mine = (f: FloodItem) => chosen === null || key(f.from) === chosen;
  const arrived = input.floods.filter((f) => f.at >= since && f.at <= now && mine(f));
  const onWay = input.floods.filter((f) => f.at > now && mine(f)).sort((a, b) => a.at - b.at);
  const senders = new Set(input.senders.map(key));

  const rows = input.members.map((player): MemberRow => {
    const theirs = arrived.filter((f) => key(f.from) === key(player));
    return {
      player,
      sends: senders.has(key(player)),
      count: theirs.length,
      take: theirs.reduce((sum, f) => sum + (f.take ?? 0), 0),
      withoutPlan: theirs.filter((f) => f.take === null).length,
      targets: new Set(theirs.map((f) => key(f.target))).size,
      onWay: onWay.filter((f) => key(f.from) === key(player)).length,
      last: theirs.length === 0 ? null : Math.max(...theirs.map((f) => f.at)),
    };
  });

  const members = new Map(input.members.map((m) => [key(m), m]));
  const targets = new Map<string, TargetRow & { takes: Map<string, number> }>();
  for (const f of arrived) {
    const row = targets.get(key(f.target)) ?? {
      target: f.target,
      count: 0,
      take: 0,
      withoutPlan: 0,
      by: [],
      last: 0,
      takes: new Map<string, number>(),
    };
    row.count += 1;
    row.take += f.take ?? 0;
    if (f.take === null) row.withoutPlan += 1;
    row.last = Math.max(row.last, f.at);
    const by = members.get(key(f.from)) ?? f.from;
    row.takes.set(by, (row.takes.get(by) ?? 0) + (f.take ?? 0));
    targets.set(key(f.target), row);
  }
  const targetRows = [...targets.values()].map(({ takes, ...row }) => ({
    ...row,
    by: [...takes.entries()].sort((a, b) => b[1] - a[1]).map(([player]) => player),
  }));

  const units: Record<string, number> = {};
  const armed = arrived.filter((f) => f.army !== null);
  for (const f of armed) for (const [unit, n] of Object.entries(f.army ?? {})) units[unit] = (units[unit] ?? 0) + n;
  const buckets: Bucket[] = [];
  if (input.period === "24h")
    // Paris is a whole number of hours from UTC: its hours start with UTC's.
    for (let start = Math.floor(since / HOUR) * HOUR; start < now; start += HOUR)
      buckets.push({ start, label: `${String(parisParts(new Date(start)).hours)} h`, count: 0, take: 0 });
  else
    for (let back = 6; back >= 0; back--) {
      const start = parisMidnight(input.now, back);
      buckets.push({ start, label: dayMonth(new Date(start)), count: 0, take: 0 });
    }
  for (const f of arrived) {
    const bucket = buckets.findLast((b) => b.start <= f.at);
    if (!bucket) continue;
    bucket.count += 1;
    bucket.take += f.take ?? 0;
  }
  const missing = input.members.filter((m) => !senders.has(key(m)));

  return {
    since,
    arrived: {
      count: arrived.length,
      take: arrived.reduce((sum, f) => sum + (f.take ?? 0), 0),
      withoutPlan: arrived.filter((f) => f.take === null).length,
    },
    rows: rows.sort(byTake),
    self: rows.find((row) => key(row.player) === chosen) ?? null,
    targets: targetRows
      .sort((a, b) => b.take - a.take || b.count - a.count || a.target.localeCompare(b.target))
      .slice(0, TARGETS_SHOWN),
    buckets,
    onWay: { count: onWay.length, next: onWay.slice(0, NEXT_SHOWN) },
    coverage: { members: input.members.length, senders: input.members.length - missing.length, missing },
    army: armed.length === 0 ? null : { units, floods: armed.length },
    targetCount: { all: targetRows.length, shared: targetRows.filter((row) => row.by.length > 1).length },
  };
}

const floodsWord = (count: number) => `${formatNumber(count)} flood${count > 1 ? "s" : ""}`;

/** « ≥ 1,5M » when some floods have no take, « 1,5M » otherwise. */
const takeText = (take: number, withoutPlan: number) => `${withoutPlan > 0 ? "≥ " : ""}${formatCompact(take)}`;

/**
 * The statistics as a message to paste in the alliance's Discord: copied, never sent by Optizzz. Never the army,
 * reserved to the Admins: a Discord channel is read by all. `alliances` (lower-case pseudo → tag) names the targets'.
 */
export function floodStatsDiscord(
  stats: FloodStats,
  context: { tag: string; period: FloodPeriod; now: Date; alliances: ReadonlyMap<string, string | null> | null },
): string {
  const period =
    context.period === "24h"
      ? `24 heures** (depuis le ${formatDateTime(new Date(stats.since))})`
      : `7 jours** (du ${dayMonth(new Date(stats.since))} au ${dayMonth(context.now)})`;
  const title = stats.self ? `**Floods de ${stats.self.player} (${context.tag}) · ` : `**Floods ${context.tag} · `;
  const { arrived } = stats;
  if (arrived.count === 0) return [title + period, "Aucun flood arrivé."].join("\n");

  const targetName = (target: string) => {
    const tag = context.alliances?.get(target.toLowerCase());
    return tag ? `${target} [${tag}]` : target;
  };
  const targets = stats.targets
    .slice(0, 3)
    .map((t) => `${targetName(t.target)} (${floodsWord(t.count)}, ${takeText(t.take, t.withoutPlan)})`);
  const { missing } = stats.coverage;
  return [
    title + period,
    `${floodsWord(arrived.count)} arrivé${arrived.count > 1 ? "s" : ""} · prise attendue ${takeText(arrived.take, arrived.withoutPlan)}${arrived.withoutPlan > 0 ? ` (${formatNumber(arrived.withoutPlan)} sans le Plan)` : ""}`,
    ...(stats.self
      ? []
      : stats.rows
          .filter((row) => row.count > 0)
          .map(
            (row) =>
              `- ${row.player} : ${floodsWord(row.count)} · prise ${takeText(row.take, row.withoutPlan)} · ${formatNumber(row.targets)} cible${row.targets > 1 ? "s" : ""}`,
          )),
    `Cibles : ${targets.join(", ")}`,
    ...(stats.self || missing.length === 0
      ? []
      : [`(${listNames(missing)} ${missing.length > 1 ? "n'envoient pas leurs" : "n'envoie pas ses"} floods)`]),
  ].join("\n");
}
