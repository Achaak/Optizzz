// Armes and Bouclier Thoracique against laying: a research costs workers, and laying them again takes time the Queen
// could spend laying units instead. Both raise the army by a share of one stat: the research by 10 % of the army's
// base, the units by what they bring with the current bonus. See docs/features/conseils-recherche.md.
import { levelBonus, UNITS, WORKER_LAYING_SECONDS, type Army } from "@optizzz/game/army/units";

/** The stat compared: life for Bouclier, attack or defense damage for Armes. */
export type AdviceStat = "hp" | "attack" | "defense";

export interface AdviceInput {
  stat: AdviceStat;
  /** The research's level before this one: the bonus the new units get. */
  level: number;
  /** Workers the research costs. */
  workers: number;
  army: Army;
  /** The player's laying speed (factor of the base times). */
  speed: number;
  /** Keys of the units the player can lay. */
  layable: readonly string[];
}

export interface UnitOption {
  key: string;
  /** Units laid in the time. */
  count: number;
  /** What they add to the stat, with the current bonus. */
  gain: number;
}

export interface Advice {
  /** Milliseconds to lay the workers again. */
  layingMs: number;
  /** The army's stat before any bonus. */
  armyBase: number;
  /** What one more level adds to the army. */
  researchGain: number;
  /** Every unit that can be laid, best gain first. */
  options: UnitOption[];
  /** The best of them; null when none can be laid in that time. */
  best: UnitOption | null;
  /** How much more the research brings than the best unit (0.5 for +50 %); null without a unit. */
  edge: number | null;
  /** Base stat of the army from which the research brings more than the best unit. */
  breakEven: number;
}

/** One level of Armes or Bouclier: +10 % of the base. */
const LEVEL_STEP = levelBonus(1) - levelBonus(0);

export function researchAdvice({ stat, level, workers, army, speed, layable }: AdviceInput): Advice {
  const layingSeconds = workers * WORKER_LAYING_SECONDS * speed;
  const armyBase = UNITS.reduce((sum, unit, i) => sum + (army[i] ?? 0) * unit[stat], 0);
  const researchGain = armyBase * LEVEL_STEP;
  const options = UNITS.filter((unit) => layable.includes(unit.key))
    .map((unit) => {
      // A hair of slack: 7 235 s at 14,13 s each is 512 units, not 511,999….
      const count = Math.floor(layingSeconds / (unit.layingSeconds * speed) + 1e-9);
      return { key: unit.key, count, gain: count * unit[stat] * levelBonus(level) };
    })
    .filter((option) => option.count > 0)
    .sort((a, b) => b.gain - a.gain);
  const best = options[0] ?? null;
  return {
    layingMs: layingSeconds * 1000,
    armyBase,
    researchGain,
    options,
    best,
    edge: best ? researchGain / best.gain - 1 : null,
    breakEven: best ? best.gain / LEVEL_STEP : 0,
  };
}

export type Verdict = "research" | "laying" | "even";

/** Within 5 %, the estimate cannot tell them apart. */
const EVEN = 0.05;

export function verdictOf(edge: number | null): Verdict {
  if (edge === null || edge > EVEN) return "research";
  return edge < -EVEN ? "laying" : "even";
}
