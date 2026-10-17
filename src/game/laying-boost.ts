// Couveuse, Solarium and Technique de ponte each make laying 10 % faster a level: Reine.php's speed is 0.9 to the power
// of their three levels added up (S5, 2026-10-17). They bring the same, so the cheapest next level wins, the levels
// of a missing requirement (Laboratoire for Technique de ponte) included. See docs/features/conseils-recherche.md.
import { sameName } from "./levels";
import type { Cost } from "./pages/resources";
import { costGrowthOf, levelsAhead } from "./speed-up";

export const LAYING_BOOSTS = ["Couveuse", "Solarium", "Technique de ponte"] as const;

/** × per level of any of them, on the laying time. */
export const LAYING_FACTOR = 0.9;

export interface Requirement {
  name: string;
  level: number;
}

/** A row of construction.php or laboratoire.php. */
export interface BoostRow {
  name: string;
  /** Highest level shown, those under way included: the row shows the cost of the level after. */
  level: number;
  cost: Cost;
  /** What the row's next level is missing (« Requis : Laboratoire niveau 10 »). */
  requirements: Requirement[];
}

export interface LayingBoost {
  name: string;
  /** Level gained. */
  level: number;
  /** The requirements to raise first, at the level needed. */
  requirements: Requirement[];
  /** The level and its requirements. */
  cost: Cost;
  /** Food and materials added up. */
  total: number;
  /** False when a requirement could not be costed (unknown, or missing a requirement itself). */
  complete: boolean;
}

const add = (a: Cost, b: Cost): Cost => ({
  food: a.food + b.food,
  materials: a.materials + b.materials,
  workers: a.workers + b.workers,
});

/** What the next level of `row` costs, the missing levels of its requirements included. */
export function layingBoost(row: BoostRow, rows: readonly BoostRow[]): LayingBoost {
  let cost = row.cost;
  let complete = true;
  const requirements: Requirement[] = [];
  for (const requirement of row.requirements) {
    const source = rows.find((candidate) => sameName(candidate.name, requirement.name));
    const missing = source ? requirement.level - source.level : 0;
    if (!source || source.requirements.length > 0) complete = false;
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
  }
  return { name: row.name, level: row.level + 1, requirements, cost, total: cost.food + cost.materials, complete };
}

/** Couveuse, Solarium and Technique de ponte among `rows`, cheapest first. */
export function rankLayingBoosts(rows: readonly BoostRow[]): LayingBoost[] {
  return rows
    .filter((row) => LAYING_BOOSTS.some((name) => sameName(name, row.name)))
    .map((row) => layingBoost(row, rows))
    .sort((a, b) => a.total - b.total);
}
