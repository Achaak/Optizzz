// Curves drawn from the history: one player, one score.
import type { Scores } from "@optizzz/game/pages/scores";
import type { Snapshot } from "./api";
import { versionDate } from "@/data/export-history";
import type { Point } from "@/utils/history-chart/chart-option";

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
