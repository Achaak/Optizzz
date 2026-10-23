// What developing a building or a research costs and takes from one level to another, with the time bonus of
// Architecture (buildings) or Salle d'analyse (research). The growth from one level to the next is the table's
// (@optizzz/game/level-costs), the bonus the game's (@optizzz/game/speed-up). See docs/features/site-couts.md.
import { levelCost, type LevelKey } from "@optizzz/game/level-costs";
import { BUILDINGS } from "@optizzz/game/levels";
import type { Cost } from "@optizzz/game/pages/resources";
import { SPEED_UP_FACTOR } from "@optizzz/game/speed-up";

/** The level that shortens the element's times. */
export type BonusKey = "architecture" | "analysisRoom";

export const bonusKeyOf = (key: LevelKey): BonusKey =>
  BUILDINGS.some((building) => building.key === key) ? "architecture" : "analysisRoom";

/**
 * Seconds level `level` takes with `bonus` levels of Architecture or Salle d'analyse: the game takes 10 % off per
 * level from the unrounded time, then rounds to the second, level by level.
 */
export const levelSeconds = (key: LevelKey, level: number, bonus: number): number =>
  Math.round(levelCost(key, level).seconds * SPEED_UP_FACTOR ** bonus);

interface PlanRow {
  level: number;
  cost: Cost;
  seconds: number;
  /** From the level held up to this one. */
  totalCost: Cost;
  totalSeconds: number;
}

export interface DevelopmentPlan {
  rows: PlanRow[];
  total: { cost: Cost; seconds: number };
}

const addCosts = (a: Cost, b: Cost): Cost => ({
  food: a.food + b.food,
  materials: a.materials + b.materials,
  workers: a.workers + b.workers,
});

/** The levels after `from` (the level held) up to `to`; none when `to` is not above `from`. */
export function developmentPlan(key: LevelKey, from: number, to: number, bonus: number): DevelopmentPlan {
  const rows: PlanRow[] = [];
  let totalCost: Cost = { food: 0, materials: 0, workers: 0 };
  let totalSeconds = 0;
  for (let level = from + 1; level <= to; level++) {
    const { cost } = levelCost(key, level);
    const seconds = levelSeconds(key, level, bonus);
    totalCost = addCosts(totalCost, cost);
    totalSeconds += seconds;
    rows.push({ level, cost, seconds, totalCost, totalSeconds });
  }
  return { rows, total: { cost: totalCost, seconds: totalSeconds } };
}

export type Resource = keyof Cost;

const RESOURCES: readonly Resource[] = ["food", "materials", "workers"];

/** What the element costs, in the game's order: a building costs materials only. */
export const costedResources = (key: LevelKey): Resource[] =>
  RESOURCES.filter((resource) => levelCost(key, 1).cost[resource] > 0);
