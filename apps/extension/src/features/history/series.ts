// Curves drawn from the history: one player, one score.
import type { Scores } from "@optizzz/game/pages/scores";
import type { Snapshot } from "./api";
import { versionDate } from "@optizzz/game/export-versions";
import type { Point } from "@/utils/history-chart/chart-option";
import { inactivityOf } from "@/data/nights";
import { formatNumber } from "@optizzz/game/format/number-format";
import { relativeRank, type RelativeRank } from "@optizzz/game/analysis/peers";

export type Metric = keyof Scores;

export type { Point } from "@/utils/history-chart/chart-option";

/** Scores read on the current page: the members table has no trophies. */
export interface LiveScores {
  time: Date;
  scores: Partial<Scores>;
}

/** The player's `metric` at each export where they exist, then the live value if the page shows it. */
export function playerSeries(
  history: readonly Snapshot[],
  playerId: number,
  metric: Metric,
  live?: LiveScores,
): Point[] {
  const points = history.flatMap(({ version, players }) => {
    const scores = players.get(playerId);
    return scores ? [{ time: versionDate(version).getTime(), value: scores[metric], live: false }] : [];
  });
  const liveValue = live?.scores[metric];
  if (live && liveValue !== undefined) points.push({ time: live.time.getTime(), value: liveValue, live: true });
  return points;
}

export { periodProgress, type Progress } from "@/utils/history-chart/progress";

/** Scores read on the members page, by player id. */
export interface LiveMembers {
  time: Date;
  scores: ReadonlyMap<number, Partial<Scores>>;
}

const mean = (values: readonly number[]) =>
  values.length === 0 ? undefined : values.reduce((sum, value) => sum + value, 0) / values.length;

/** Average `metric` of the players among `playerIds` present at each export, then of their live values. */
export function averageSeries(
  history: readonly Snapshot[],
  playerIds: readonly number[],
  metric: Metric,
  live?: LiveMembers,
): Point[] {
  const points = history.flatMap(({ version, players }) => {
    const value = mean(playerIds.flatMap((id) => players.get(id)?.[metric] ?? []));
    return value === undefined ? [] : [{ time: versionDate(version).getTime(), value, live: false }];
  });
  const liveValue = live && mean(playerIds.flatMap((id) => live.scores.get(id)?.[metric] ?? []));
  if (live && liveValue !== undefined) points.push({ time: live.time.getTime(), value: liveValue, live: true });
  return points;
}

/**
 * Each of `ids`' rank among the players of its size over the period (`history`, oldest first): its TDC's growth from
 * the first export to the last, against the players from half to twice its TDC at the start, without `unavailable`
 * (on holiday, banned) nor the probably inactive. See docs/features/analyse-joueurs.md.
 */
export function periodRanks(
  history: readonly Snapshot[],
  ids: readonly number[],
  unavailable: ReadonlySet<number>,
): Map<number, RelativeRank | null> {
  const first = history[0];
  const last = history.at(-1);
  const ranks = new Map<number, RelativeRank | null>();
  if (!first || !last || first === last) {
    for (const id of ids) ranks.set(id, null);
    return ranks;
  }
  const fieldsOf = (snapshot: Snapshot) => new Map([...snapshot.players].map(([id, scores]) => [id, scores.field]));
  const start = fieldsOf(first);
  const end = fieldsOf(last);
  const excluded = new Set(unavailable);
  for (const id of start.keys()) if (inactivityOf(history, id)) excluded.add(id);
  for (const id of ids) ranks.set(id, relativeRank(id, start, end, excluded));
  return ranks;
}

/** « Progresse plus vite que 80 % des 214 joueurs de sa taille sur la période. » */
export function rankText(rank: RelativeRank): string {
  const percent = Math.round((rank.faster / rank.peers) * 100);
  return `Progresse plus vite que ${formatNumber(percent)} % des ${formatNumber(rank.peers)} joueurs de sa taille sur la période.`;
}

/** « 80 % » for a table cell: the share of the players of its size it grew faster than. */
export const rankPercent = (rank: RelativeRank) => `${formatNumber(Math.round((rank.faster / rank.peers) * 100))} %`;
