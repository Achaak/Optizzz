// The statistics of the « Chasses » tab (docs/features/site-envois.md, « Chasses par membre »): worked out in this
// browser from the hunts log the tab opened, one per fingerprint. A hunt counts as back at its return; one still out
// has its own figures. The ants sent are known with Compte+ only: cm² for 1 000 ants counts the hunts that have them.
import type { HuntItem } from "@optizzz/game/site-links/envoi-hunts";
import { formatCompact, formatNumber } from "@optizzz/game/format/number-format";
import { dayMonth, formatDateTime, parisParts } from "@optizzz/game/format/time-format";
import { listNames, parisMidnight } from "./convoy-stats";

export const HUNT_PERIODS = ["24h", "7j", "30j"] as const;
export type HuntPeriod = (typeof HUNT_PERIODS)[number];

const HOUR = 3600_000;
const DAYS: Record<HuntPeriod, number> = { "24h": 1, "7j": 7, "30j": 30 };

export interface HuntStatsInput {
  hunts: readonly HuntItem[];
  /** The pseudos of the space's members now. */
  members: readonly string[];
  /** The members who send their Chasses. */
  senders: readonly string[];
  period: HuntPeriod;
  /** A member's pseudo: their hunts only. */
  member: string | null;
  now: Date;
}

/** A member's hunts over the period. */
export interface HuntMemberRow {
  player: string;
  /** Sends their Chasses: otherwise none of their hunts is known. */
  sends: boolean;
  count: number;
  /** The cm² of the hunts back. */
  field: number;
  /** cm² per hunt back, null without one. */
  average: number | null;
  /** Their hunts out now, and the cm² they bring. */
  out: number;
  outField: number;
  /** The latest return in the period, null without one. */
  last: number | null;
}

/** An hour (over 24 hours) or a day of Paris of the chart. */
export interface HuntBucket {
  start: number;
  /** « 13 h » or « 04/11 ». */
  label: string;
  count: number;
  field: number;
}

export interface HuntStats {
  /** Where the period starts: 24 hours ago, or midnight in Paris 6 or 29 days ago. */
  since: number;
  /** The hunts back in the period; `perDay` over the period's days. */
  returned: { count: number; field: number; average: number | null; perDay: number };
  /** The hunts out now, the 3 soonest back in `next`. */
  out: { count: number; field: number; next: HuntItem[] };
  /** cm² for 1 000 ants over the hunts back whose ants are known; null without one. */
  perThousandAnts: { value: number; hunts: number } | null;
  /** « Par membre »: the biggest field first, members without a hunt then, those who do not send last. */
  rows: HuntMemberRow[];
  /** The chosen member's row, null for the whole alliance. */
  self: HuntMemberRow | null;
  /** « Ses chasses »: the chosen member's hunts out and back in the period, latest return first. */
  own: HuntItem[];
  coverage: { members: number; senders: number; missing: string[] };
  /** The oldest hunt known, when it comes after the period's start: before it, hunts may be missing. */
  knownSince: number | null;
  buckets: HuntBucket[];
}

const NEXT_SHOWN = 3;
const key = (pseudo: string) => pseudo.toLowerCase();
const total = (hunts: readonly HuntItem[]) => hunts.reduce((sum, h) => sum + h.fieldGain, 0);

const byField = (a: HuntMemberRow, b: HuntMemberRow) =>
  Number(b.sends) - Number(a.sends) ||
  b.field - a.field ||
  b.count - a.count ||
  b.out - a.out ||
  a.player.localeCompare(b.player);

export function huntStats(input: HuntStatsInput): HuntStats {
  const now = input.now.getTime();
  const since = input.period === "24h" ? now - 24 * HOUR : parisMidnight(input.now, DAYS[input.period] - 1);
  const chosen = input.member === null ? null : key(input.member);
  const mine = (h: HuntItem) => chosen === null || key(h.hunter) === chosen;
  const returned = input.hunts.filter((h) => h.returnsAt >= since && h.returnsAt <= now && mine(h));
  const out = input.hunts.filter((h) => h.returnsAt > now && mine(h)).sort((a, b) => a.returnsAt - b.returnsAt);
  const senders = new Set(input.senders.map(key));

  const rows = input.members.map((player): HuntMemberRow => {
    const theirs = returned.filter((h) => key(h.hunter) === key(player));
    const away = out.filter((h) => key(h.hunter) === key(player));
    const field = total(theirs);
    return {
      player,
      sends: senders.has(key(player)),
      count: theirs.length,
      field,
      average: theirs.length === 0 ? null : Math.round(field / theirs.length),
      out: away.length,
      outField: total(away),
      last: theirs.length === 0 ? null : Math.max(...theirs.map((h) => h.returnsAt)),
    };
  });

  const counted = returned.filter((h) => h.ants !== null && h.ants > 0);
  const ants = counted.reduce((sum, h) => sum + (h.ants ?? 0), 0);

  const buckets: HuntBucket[] = [];
  if (input.period === "24h")
    // Paris is a whole number of hours from UTC: its hours start with UTC's.
    for (let start = Math.floor(since / HOUR) * HOUR; start < now; start += HOUR)
      buckets.push({ start, label: `${String(parisParts(new Date(start)).hours)} h`, count: 0, field: 0 });
  else
    for (let back = DAYS[input.period] - 1; back >= 0; back--) {
      const start = parisMidnight(input.now, back);
      buckets.push({ start, label: dayMonth(new Date(start)), count: 0, field: 0 });
    }
  for (const h of returned) {
    const bucket = buckets.findLast((b) => b.start <= h.returnsAt);
    if (!bucket) continue;
    bucket.count += 1;
    bucket.field += h.fieldGain;
  }

  const oldest = input.hunts.length === 0 ? null : Math.min(...input.hunts.map((h) => h.returnsAt));
  const missing = input.members.filter((m) => !senders.has(key(m)));
  const field = total(returned);
  return {
    since,
    returned: {
      count: returned.length,
      field,
      average: returned.length === 0 ? null : Math.round(field / returned.length),
      perDay: returned.length / DAYS[input.period],
    },
    out: { count: out.length, field: total(out), next: out.slice(0, NEXT_SHOWN) },
    perThousandAnts: ants === 0 ? null : { value: Math.round((total(counted) / ants) * 1000), hunts: counted.length },
    rows: rows.sort(byField),
    self: rows.find((row) => key(row.player) === chosen) ?? null,
    own: chosen === null ? [] : [...out, ...returned].sort((a, b) => b.returnsAt - a.returnsAt),
    coverage: { members: input.members.length, senders: input.members.length - missing.length, missing },
    knownSince: oldest !== null && oldest > since ? oldest : null,
    buckets,
  };
}

const huntsWord = (count: number) => `${formatNumber(count)} chasse${count > 1 ? "s" : ""}`;

/** The statistics as a message to paste in the alliance's Discord: copied, never sent by Optizzz. */
export function huntStatsDiscord(stats: HuntStats, context: { tag: string; period: HuntPeriod; now: Date }): string {
  const period =
    context.period === "24h"
      ? `24 heures** (depuis le ${formatDateTime(new Date(stats.since))})`
      : `${String(DAYS[context.period])} jours** (du ${dayMonth(new Date(stats.since))} au ${dayMonth(context.now)})`;
  const title = stats.self ? `**Chasses de ${stats.self.player} (${context.tag}) · ` : `**Chasses ${context.tag} · `;
  const { returned } = stats;
  if (returned.count === 0) return [title + period, "Aucune chasse rentrée."].join("\n");
  const { missing } = stats.coverage;
  return [
    title + period,
    `${huntsWord(returned.count)} rentrée${returned.count > 1 ? "s" : ""} · ${formatCompact(returned.field)} cm² · ${formatCompact(returned.average ?? 0)} cm² par chasse`,
    ...(stats.self
      ? []
      : stats.rows
          .filter((row) => row.count > 0)
          .map((row) => `- ${row.player} : ${huntsWord(row.count)} · ${formatCompact(row.field)} cm²`)),
    ...(stats.self || missing.length === 0
      ? []
      : [`(${listNames(missing)} ${missing.length > 1 ? "n'envoient pas leurs" : "n'envoie pas ses"} chasses)`]),
  ].join("\n");
}
