// Couveuse, Solarium and Technique de ponte each make laying 10 % faster a level: Reine.php's speed is 0.9 to the power
// of their three levels added up (S5, 2026-10-17). They bring the same, so the cheapest next level wins, the levels
// of a missing requirement (Laboratoire for Technique de ponte) included. See docs/features/conseils-recherche.md.
import { sameName } from "./levels";
import { costWithRequirements, type LevelCost, type LevelRow } from "./requirements";

export const LAYING_BOOSTS = ["Couveuse", "Solarium", "Technique de ponte"] as const;

/** × per level of any of them, on the laying time. */
export const LAYING_FACTOR = 0.9;

/** Couveuse, Solarium and Technique de ponte among `rows`, cheapest first. */
export function rankLayingBoosts(rows: readonly LevelRow[]): LevelCost[] {
  return rows
    .filter((row) => LAYING_BOOSTS.some((name) => sameName(name, row.name)))
    .map((row) => costWithRequirements(row, rows))
    .sort((a, b) => a.total - b.total);
}
