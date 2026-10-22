// What the next level of a row of construction.php or laboratoire.php costs, the missing levels of its requirements
// (« Requis : Laboratoire niveau 10 ») included. Each level costs double the one before (× 1.85 for the
// Champignonnière). See docs/features/conseils-recherche.md.
import { sameName } from "./levels";
import type { Cost } from "./pages/resources";
import { costGrowthOf, levelsAhead } from "./speed-up";

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
  /** What the row's next level is missing (« Requis : Laboratoire niveau 10 »). */
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

/** A requirement of a requirement is costed this deep at most: the game's chains are short. */
const MAX_DEPTH = 3;

/** What the missing levels of `row`'s requirements cost, theirs included. */
function requirementsCost(
  row: LevelRow,
  rows: readonly LevelRow[],
  depth: number,
): Pick<LevelCost, "cost" | "complete" | "requirements"> {
  let cost: Cost = { food: 0, materials: 0, workers: 0 };
  let complete = true;
  const requirements: Requirement[] = [];
  for (const requirement of row.requirements) {
    const source = rows.find((candidate) => sameName(candidate.name, requirement.name));
    const missing = source ? requirement.level - source.level : 0;
    if (!source) complete = false;
    if (!source || missing <= 0) continue;
    const levels = levelsAhead({
      cost: source.cost,
      duration: 0,
      growth: 1,
      costGrowth: costGrowthOf(source.name),
      count: missing,
    }).at(-1);
    if (levels) cost = add(cost, levels.cost);
    requirements.push(requirement);
    if (source.requirements.length === 0) continue;
    // The row shows what its next level needs: the levels after may need more.
    if (missing > 1 || depth >= MAX_DEPTH) complete = false;
    if (depth >= MAX_DEPTH) continue;
    const own = requirementsCost(source, rows, depth + 1);
    cost = add(cost, own.cost);
    complete &&= own.complete;
    for (const nested of own.requirements) {
      if (!requirements.some((known) => sameName(known.name, nested.name))) requirements.push(nested);
    }
  }
  return { cost, complete, requirements };
}

/** What the next level of `row` costs, the missing levels of its requirements included. */
export function costWithRequirements(row: LevelRow, rows: readonly LevelRow[]): LevelCost {
  const own = requirementsCost(row, rows, 1);
  const cost = add(row.cost, own.cost);
  return {
    name: row.name,
    level: row.level + 1,
    requirements: own.requirements,
    cost,
    total: cost.food + cost.materials,
    complete: own.complete,
  };
}
