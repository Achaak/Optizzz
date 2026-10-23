// What any level of a building or a research costs and how long it takes, bonuses aside (no Architecture, no Salle
// d'analyse), and the levels from one to another added up. First levels read on 2026-10-23 from toolzzz.fr/couts.php
// and checked on s5 and s2: docs/research/couts-des-niveaux.md. The one place that knows how a level grows from the
// one before: the features scale what the game shows with it.

import { BUILDINGS, RESEARCH, sameName, type BuildingKey, type ResearchKey } from "./levels";
import type { Cost } from "./pages/resources";

export type LevelKey = BuildingKey | ResearchKey;

export interface LevelCost {
  cost: Cost;
  /** Seconds, unrounded: the game applies its bonus, then rounds to the second. */
  seconds: number;
}

/**
 * Each level takes longer than the one before, bonuses aside: × 1.6 for a building, × 1.7 for a research (Toolzzz's
 * per-level times, checked against s5: Architecture 8 in 8 207 s, Salle d'analyse 4 in 1 229 s before bonuses), until
 * the slowdowns below.
 */
const TIME_GROWTH = { building: 1.6, research: 1.7 } as const;
/** Costs double from one level to the next (Toolzzz's cost table)… */
const COST_GROWTH = 2;
/** …but the Champignonnière's: × 1.85 a level, floored (90, 166, 308, 569… materials). */
const MUSHROOM_COST_GROWTH = 1.85;

/** From level `from` on, each level takes `growth` × the one before instead of × 1.6 or × 1.7. */
interface TimeSlowdown {
  from: number;
  growth: number;
}

interface LevelBase extends LevelCost {
  /** The time growth slows down at these levels (Toolzzz; × 1.3 seen on s2, the others not yet). */
  slowdowns: readonly TimeSlowdown[];
}

const slowdowns = (to13: number, to12?: number, to112?: number): TimeSlowdown[] => [
  { from: to13, growth: 1.3 },
  ...(to12 ? [{ from: to12, growth: 1.2 }] : []),
  ...(to112 ? [{ from: to112, growth: 1.12 }] : []),
];

const materials = (amount: number): Cost => ({ food: 0, materials: amount, workers: 0 });
const research = (workers: number, food: number, amount: number): Cost => ({ food, materials: amount, workers });

/** Level 1 of each building and research. */
export const LEVEL_BASES: Readonly<Record<LevelKey, LevelBase>> = {
  mushroom: { cost: materials(90), seconds: 120, slowdowns: slowdowns(24, 32, 38) },
  foodWarehouse: { cost: materials(600), seconds: 180, slowdowns: slowdowns(23, 31, 37) },
  materialWarehouse: { cost: materials(600), seconds: 180, slowdowns: slowdowns(23, 31, 37) },
  nursery: { cost: materials(600), seconds: 180, slowdowns: slowdowns(23, 31, 37) },
  solarium: { cost: materials(2_000), seconds: 1_000, slowdowns: slowdowns(19, 27, 34) },
  laboratory: { cost: materials(1_400), seconds: 300, slowdowns: slowdowns(22, 30, 36) },
  analysisRoom: { cost: materials(1_400), seconds: 300, slowdowns: slowdowns(22, 30) },
  combatRoom: { cost: materials(300), seconds: 120, slowdowns: slowdowns(24, 31) },
  barracks: { cost: materials(800), seconds: 200, slowdowns: slowdowns(22, 31) },
  dome: { cost: materials(3_500), seconds: 400, slowdowns: slowdowns(21, 29) },
  lodge: { cost: materials(5_000), seconds: 500, slowdowns: slowdowns(20, 29) },
  aphids: { cost: materials(1_500), seconds: 500, slowdowns: slowdowns(20, 31) },
  cochineal: { cost: materials(10_000), seconds: 150, slowdowns: slowdowns(23, 31) },
  laying: { cost: research(0, 120, 120), seconds: 120, slowdowns: slowdowns(21, 29, 36) },
  shield: { cost: research(80, 200, 300), seconds: 120, slowdowns: slowdowns(21, 29) },
  weapons: { cost: research(80, 300, 200), seconds: 120, slowdowns: slowdowns(21, 29) },
  architecture: { cost: research(0, 100, 200), seconds: 200, slowdowns: slowdowns(20, 29, 35) },
  animals: { cost: research(80, 200, 500), seconds: 120, slowdowns: slowdowns(21, 29) },
  huntSpeed: { cost: research(50, 4_000, 2_500), seconds: 200, slowdowns: slowdowns(20, 29) },
  attackSpeed: { cost: research(0, 3_000, 1_000), seconds: 200, slowdowns: slowdowns(20, 29) },
  genetics: { cost: research(1_000, 3_000, 10_000), seconds: 180, slowdowns: slowdowns(21, 29) },
  acid: { cost: research(5_000, 100_000, 300_000), seconds: 10_000, slowdowns: slowdowns(13, 29) },
  // Toolzzz never slows the Poison down, up to its level 20.
  poison: { cost: research(250_000, 40_000_000, 15_000_000), seconds: 50_000, slowdowns: [] },
};

const isBuilding = (key: LevelKey): key is BuildingKey => BUILDINGS.some((building) => building.key === key);

/** The building or research the game names `name` (accents and apostrophes aside); null when unknown. */
export const levelKeyOf = (name: string): LevelKey | null =>
  [...BUILDINGS, ...RESEARCH].find((candidate) => sameName(candidate.name, name))?.key ?? null;

function checkLevel(level: number, min: number) {
  if (!Number.isInteger(level) || level < min) throw new RangeError(`Niveau invalide : ${String(level)}`);
}

/** What level `level` (1 or more) costs and takes, bonuses aside. */
export function levelCost(key: LevelKey, level: number): LevelCost {
  checkLevel(level, 1);
  const base = LEVEL_BASES[key];
  // The game floors each level's cost: × 2 stays whole, the Champignonnière's × 1.85 does not.
  const factor = (key === "mushroom" ? MUSHROOM_COST_GROWTH : COST_GROWTH) ** (level - 1);
  const cost: Cost = {
    food: Math.floor(base.cost.food * factor),
    materials: Math.floor(base.cost.materials * factor),
    workers: Math.floor(base.cost.workers * factor),
  };
  let seconds = base.seconds;
  for (let next = 2; next <= level; next++) {
    const slowdown = base.slowdowns.findLast(({ from }) => from <= next);
    seconds *= slowdown?.growth ?? (isBuilding(key) ? TIME_GROWTH.building : TIME_GROWTH.research);
  }
  return { cost, seconds };
}

/** The levels after `from` (the level held) up to `to`, added up; nothing when `to` is not above `from`. */
export function levelsCost(key: LevelKey, from: number, to: number): LevelCost {
  checkLevel(from, 0);
  const total: LevelCost = { cost: { food: 0, materials: 0, workers: 0 }, seconds: 0 };
  for (let level = from + 1; level <= to; level++) {
    const { cost, seconds } = levelCost(key, level);
    total.cost.food += cost.food;
    total.cost.materials += cost.materials;
    total.cost.workers += cost.workers;
    total.seconds += seconds;
  }
  return total;
}

/**
 * How many times longer level `to` takes than level `from`. Architecture and Salle d'analyse take the same share off
 * every level: the ratio holds for the times the game shows, bonus included.
 */
export const levelTimeRatio = (key: LevelKey, from: number, to: number): number =>
  levelCost(key, to).seconds / levelCost(key, from).seconds;

/** A level as construction.php or laboratoire.php shows it. */
export interface ShownLevel {
  cost: Cost;
  /** Milliseconds, the player's bonus included. */
  duration: number;
}

/**
 * Level `level` and the `count` − 1 after it, from what the game shows for `level`: each grows from the shown one as
 * the table does, so the player's bonus carries over (and the table's own costs come out when the shown cost is
 * theirs, the Champignonnière's floored ones included). Costs to the unit, times to the millisecond.
 */
export function levelsFrom(key: LevelKey, level: number, shown: ShownLevel, count: number): ShownLevel[] {
  const first = levelCost(key, level);
  const scale = (amount: number, base: number, next: number) => (base > 0 ? Math.round((amount * next) / base) : 0);
  return Array.from({ length: Math.max(0, count) }, (_, index) => {
    const next = levelCost(key, level + index);
    return {
      cost: {
        food: scale(shown.cost.food, first.cost.food, next.cost.food),
        materials: scale(shown.cost.materials, first.cost.materials, next.cost.materials),
        workers: scale(shown.cost.workers, first.cost.workers, next.cost.workers),
      },
      duration: Math.round((shown.duration * next.seconds) / first.seconds),
    };
  });
}

export interface LevelsAhead extends ShownLevel {
  /** Levels gained. */
  levels: number;
}

/**
 * The next one, two… `count` levels from `level` (the one the game shows), all together: costs added up, times one
 * after the other at the current bonus.
 */
export function levelsAhead(key: LevelKey, level: number, shown: ShownLevel, count: number): LevelsAhead[] {
  const total: LevelsAhead = { levels: 0, cost: { food: 0, materials: 0, workers: 0 }, duration: 0 };
  return levelsFrom(key, level, shown, count).map(({ cost, duration }) => {
    total.levels += 1;
    total.cost.food += cost.food;
    total.cost.materials += cost.materials;
    total.cost.workers += cost.workers;
    total.duration += duration;
    return { ...total, cost: { ...total.cost } };
  });
}
