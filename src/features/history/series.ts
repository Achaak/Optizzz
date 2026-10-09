// Curves drawn from the history: one player, one score.
import type { Scores, Snapshot } from "./api";
import { versionDate } from "./versions";

export type Metric = keyof Scores;

export interface Point {
  /** Epoch ms. */
  time: number;
  value: number;
  /** Read in the game now rather than in an export. */
  live: boolean;
}

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

export interface Progress {
  first: number;
  last: number;
  gain: number;
  /** Null when the first value is zero. */
  percent: number | null;
}

/** From the first point of the series to its last. */
export function periodProgress(series: readonly Point[]): Progress | null {
  const first = series[0]?.value;
  const last = series.at(-1)?.value;
  if (first === undefined || last === undefined) return null;
  const gain = last - first;
  return { first, last, gain, percent: first === 0 ? null : (gain / first) * 100 };
}

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
