// What the missing levels of requirements (« Requis : Laboratoire niveau 10 ») cost, theirs included, each grown from
// the one shown as the level-costs table says; and the next level of a row with them. See
// docs/features/conseils-recherche.md and docs/features/cout-deblocage.md.
import { isBuilding, levelKeyOf, levelsAhead, levelsFrom } from "./level-costs";
import { sameName } from "./levels";
import type { Cost } from "./pages/resources";

export interface Requirement {
  name: string;
  level: number;
}

/** A row of construction.php or laboratoire.php. */
export interface LevelRow {
  name: string;
  /** Highest level shown, those under way included: the row shows the cost of the level after. */
  level: number;
  cost: Cost;
  /** Milliseconds the next level takes, the player's bonus included; unknown when absent. */
  duration?: number;
  /** What the row's next level needs, reached or not (« Requis : Laboratoire niveau 10 »). */
  requirements: Requirement[];
}

export interface LevelCost {
  name: string;
  /** Level gained. */
  level: number;
  /** The requirements to raise first, at the level needed, theirs included. */
  requirements: Requirement[];
  /** The level and its requirements. */
  cost: Cost;
  /** Food and materials added up. */
  total: number;
  /** False when a requirement could not be costed (unknown, or its own requirements not all known). */
  complete: boolean;
}

const add = (a: Cost, b: Cost): Cost => ({
  food: a.food + b.food,
  materials: a.materials + b.materials,
  workers: a.workers + b.workers,
});

/** A requirement to raise: from the level it is at (under way included) to the level asked. */
export interface UnlockStep extends Requirement {
  from: number;
  /** The requirement that asks for it at this level; null for one asked first. */
  neededBy: string | null;
}

export interface UnlockCost {
  /** The levels to reach, in the order found: those asked first, then the requirements they need in turn. */
  requirements: UnlockStep[];
  /** Every missing level of them, added up. */
  cost: Cost;
  /**
   * Milliseconds until the last of them is done, Construction and Laboratoire working side by side from now, each
   * level after the levels it needs; null when a row shows no time.
   */
  duration: number | null;
  /** False when a requirement could not be costed: on none of the rows given, or unknown to the level table. */
  complete: boolean;
}

/** A chain longer than this is a mistake in the rows: the game's chains are three or four requirements long. */
const MAX_STEPS = 100;

/**
 * What reaching every one of `needed` costs, the requirements they need in turn included, from the levels the rows
 * show. A row shows what its next level needs; each level more needs each requirement one level higher
 * (docs/research/fourmizzz-pages.md, « Prérequis »). A requirement asked twice is costed once, at the highest level.
 */
export function unlockCost(needed: readonly Requirement[], rows: readonly LevelRow[]): UnlockCost {
  const targets = new Map<LevelRow, { level: number; neededBy: string | null }>();
  let complete = true;
  const queue: { name: string; level: number; neededBy: string | null }[] = needed.map((requirement) => ({
    ...requirement,
    neededBy: null,
  }));
  for (let step = 0; step < MAX_STEPS && queue.length > 0; step++) {
    const requirement = queue.shift();
    if (!requirement) break;
    const source = rows.find((candidate) => sameName(candidate.name, requirement.name));
    if (!source || !levelKeyOf(source.name)) {
      complete = false;
      continue;
    }
    if (requirement.level <= (targets.get(source)?.level ?? source.level)) continue;
    targets.set(source, { level: requirement.level, neededBy: requirement.neededBy });
    const gained = requirement.level - (source.level + 1);
    for (const own of source.requirements) {
      queue.push({ name: own.name, level: own.level + gained, neededBy: source.name });
    }
  }
  if (queue.length > 0) complete = false;
  let cost: Cost = { food: 0, materials: 0, workers: 0 };
  for (const [source, { level }] of targets) {
    const key = levelKeyOf(source.name);
    const levels = key && levelsAhead(key, source.level + 1, { cost: source.cost, duration: 0 }, level - source.level);
    if (levels?.length) cost = add(cost, levels[levels.length - 1]?.cost ?? cost);
  }
  return {
    duration: schedule(
      [...targets].map(([source, { level }]) => ({ source, level })),
      rows,
    ),
    requirements: [...targets].map(([source, { level, neededBy }]) => ({
      name: source.name,
      level,
      from: source.level,
      neededBy,
    })),
    cost,
    complete,
  };
}

/** One level to do: on which row, how long, and the levels it waits for. */
interface Job {
  row: LevelRow;
  level: number;
  duration: number;
  building: boolean;
  needs: { row: LevelRow; level: number }[];
}

/**
 * When the last of the levels up to each target is done: each queue (Construction, Laboratoire) does one level at a
 * time, in order on a row, a level once those it needs are done. A queue takes first a level that another one waits
 * for. The game's own queues are taken as free. Null when a row shows no time.
 */
function schedule(targets: readonly { source: LevelRow; level: number }[], rows: readonly LevelRow[]): number | null {
  const jobs: Job[] = [];
  for (const { source, level } of targets) {
    const key = levelKeyOf(source.name);
    if (!key || source.duration === undefined) return null;
    const count = level - source.level;
    const shown = { cost: source.cost, duration: source.duration };
    levelsFrom(key, source.level + 1, shown, count).forEach(({ duration }, index) => {
      const gained = index;
      const needs = source.requirements.flatMap((requirement) => {
        const row = rows.find((candidate) => sameName(candidate.name, requirement.name));
        const needed = requirement.level + gained;
        return row && needed > row.level ? [{ row, level: needed }] : [];
      });
      jobs.push({ row: source, level: source.level + 1 + index, duration, building: isBuilding(key), needs });
    });
  }
  const finished = new Map<LevelRow, Map<number, number>>();
  const doneAt = (row: LevelRow, level: number) => (level <= row.level ? 0 : finished.get(row)?.get(level));
  const free = { building: 0, research: 0 };
  const pending = [...jobs];
  let end = 0;
  while (pending.length > 0) {
    // The next level of each row, ready when the levels it needs are done.
    const ready = pending.flatMap((job) => {
      if (doneAt(job.row, job.level - 1) === undefined) return [];
      const after = [doneAt(job.row, job.level - 1), ...job.needs.map((need) => doneAt(need.row, need.level))];
      if (after.some((time) => time === undefined)) return [];
      const queue = job.building ? free.building : free.research;
      return [{ job, start: Math.max(queue, ...(after as number[])) }];
    });
    const awaited = (job: Job) =>
      pending.some((other) => other.needs.some((need) => need.row === job.row && need.level >= job.level));
    const [next] = ready.sort((a, b) => a.start - b.start || Number(awaited(b.job)) - Number(awaited(a.job)));
    if (!next) break;
    const { job, start } = next;
    const at = start + job.duration;
    if (!finished.has(job.row)) finished.set(job.row, new Map());
    finished.get(job.row)?.set(job.level, at);
    if (job.building) free.building = at;
    else free.research = at;
    end = Math.max(end, at);
    pending.splice(pending.indexOf(job), 1);
  }
  return end;
}

/** What the next level of `row` costs, the missing levels of its requirements included. */
export function costWithRequirements(row: LevelRow, rows: readonly LevelRow[]): LevelCost {
  const own = unlockCost(row.requirements, rows);
  const cost = add(row.cost, own.cost);
  return {
    name: row.name,
    level: row.level + 1,
    requirements: own.requirements.map(({ name, level }) => ({ name, level })),
    cost,
    total: cost.food + cost.materials,
    complete: own.complete,
  };
}
