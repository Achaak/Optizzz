// Architecture (construction times) and Salle d'analyse (research times): each level takes 10 % off the current
// time, × 0.9 per level, as the game's level-0 times show (docs/research/fourmizzz-pages.md, « Temps des chantiers »).
// Is it worth waiting for the next level before ordering a building or a research?

import { sameName } from "./levels";
import type { Cost } from "./pages/resources";

export const SPEED_UP_FACTOR = 0.9;

export interface SpeedUpInput {
  now: Date;
  /** The row's time as the game shows it, current bonus included. */
  duration: number;
  /** When the row would start if ordered as soon as it can be: paid, and its queue free. */
  startsAt: Date;
  /** When the speed-up levels are done. */
  speedUpReady: Date;
  /** Speed-up levels gained by then. */
  levels: number;
}

export interface SpeedUp {
  /** End when ordered as soon as it can be. */
  endsNow: Date;
  /** End when ordered once the speed-up is done. */
  endsAfter: Date;
  /** Milliseconds saved by waiting; negative when waiting delays the end. */
  saved: number;
}

/** The time a row takes is fixed when it is ordered: waiting means ordering after the speed-up. */
export function speedUpFirst({ now, duration, startsAt, speedUpReady, levels }: SpeedUpInput): SpeedUp {
  const start = Math.max(now.getTime(), startsAt.getTime());
  const endsNow = new Date(start + duration);
  const endsAfter = new Date(
    Math.max(start, speedUpReady.getTime()) + Math.round(duration * SPEED_UP_FACTOR ** levels),
  );
  return { endsNow, endsAfter, saved: endsNow.getTime() - endsAfter.getTime() };
}

/**
 * Each level takes longer than the one before, bonuses aside: × 1.6 for a building, × 1.7 for a research (Toolzzz's
 * per-level times, checked against s5: Architecture 8 in 8 207 s, Salle d'analyse 4 in 1 229 s before bonuses).
 */
export const LEVEL_TIME_GROWTH = { construction: 1.6, research: 1.7 } as const;
/** Costs double from one level to the next (Toolzzz's cost table). */
export const LEVEL_COST_GROWTH = 2;
/** But the Champignonnière's: × 1.85 a level, rounded (90, 167, 308, 570… materials). */
const MUSHROOM_COST_GROWTH = 1.85;

/** How a row's cost grows from one level to the next. */
export const costGrowthOf = (name: string) =>
  sameName(name, "Champignonnière") ? MUSHROOM_COST_GROWTH : LEVEL_COST_GROWTH;

export interface SpeedUpLevel {
  /** Levels gained once it is done (those already queued included). */
  levels: number;
  ready: Date;
}

export interface LevelsInput {
  /** When the first new level can start: its queue free. */
  start: Date;
  /** Levels already queued, and when the last of them ends. */
  queued: SpeedUpLevel | null;
  /** Time of the first new level, as the game shows it. */
  duration: number;
  growth: number;
  /** When `share` × the first new level's cost (all levels up to one) is paid; null when never. */
  paidAt: (share: number) => Date | null;
  /** The most new levels considered. */
  max: number;
}

/** The plans: the levels already queued alone (when any), then one, two… more levels, each after the last. */
export function speedUpLevels({ start, queued, duration, growth, paidAt, max }: LevelsInput): SpeedUpLevel[] {
  const plans: SpeedUpLevel[] = queued ? [queued] : [];
  const already = queued?.levels ?? 0;
  let end = start.getTime();
  for (let extra = 1; extra <= max; extra++) {
    // Paid together: the levels so far cost 1 + 2 + 4… times the first.
    const paid = paidAt((LEVEL_COST_GROWTH ** extra - 1) / (LEVEL_COST_GROWTH - 1));
    if (!paid) break;
    end = Math.max(end, paid.getTime()) + Math.round(duration * growth ** (extra - 1));
    plans.push({ levels: already + extra, ready: new Date(end) });
  }
  return plans;
}

/** Below a minute, the game's rounded times cannot tell two plans apart: the shorter plan wins. */
const SIGNIFICANT_MS = 60_000;

/** The plan that makes the row end soonest, when it ends sooner than ordering now. */
export function bestSpeedUp(
  row: Pick<SpeedUpInput, "now" | "duration" | "startsAt">,
  plans: readonly SpeedUpLevel[],
): (SpeedUp & { plan: SpeedUpLevel }) | null {
  let best: (SpeedUp & { plan: SpeedUpLevel }) | null = null;
  for (const plan of plans) {
    const result = speedUpFirst({ ...row, speedUpReady: plan.ready, levels: plan.levels });
    if (result.saved > (best?.saved ?? 0) + SIGNIFICANT_MS) best = { ...result, plan };
  }
  return best;
}

export interface LevelsAheadInput {
  /** Cost of the next level, as the game shows it. */
  cost: Cost;
  /** Time of the next level, as the game shows it (current bonus included). */
  duration: number;
  growth: number;
  /** × per level of the cost; doubles by default. */
  costGrowth?: number;
  count: number;
}

export interface LevelsAhead {
  /** Levels gained. */
  levels: number;
  /** All of them together. */
  cost: Cost;
  /** One after the other, at the current bonus. */
  duration: number;
}

/** The cost and time of the next one, two… `count` levels, all together; each level's cost rounded, as the game does. */
export function levelsAhead({
  cost,
  duration,
  growth,
  costGrowth = LEVEL_COST_GROWTH,
  count,
}: LevelsAheadInput): LevelsAhead[] {
  const result: LevelsAhead[] = [];
  const total: Cost = { food: 0, materials: 0, workers: 0 };
  let time = 0;
  for (let levels = 1; levels <= count; levels++) {
    const factor = costGrowth ** (levels - 1);
    for (const resource of ["food", "materials", "workers"] as const)
      total[resource] += Math.round(cost[resource] * factor);
    time += Math.round(duration * growth ** (levels - 1));
    result.push({ levels, cost: { ...total }, duration: time });
  }
  return result;
}
