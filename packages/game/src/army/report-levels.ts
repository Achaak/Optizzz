// The defender's Bouclier, Dôme or Loge read back from an attack report: every level that gives the defenders the hp
// for the report's kills, exchange by exchange (docs/features/combat-reports.md, « Niveaux adverses »).
import { placeHpBonus, type Place } from "./battle";
import { EPSILON } from "./rounds";
import { levelBonus, UNITS } from "./units";
import { countsToArmy, type Counts } from "./army-text";

/** One exchange of the report: the damage the attacker dealt, Weapons included, and the defenders it killed. */
export interface ReportExchange {
  dealt: number;
  killed: number;
}

export interface DefenseLevels {
  shield: number;
  /** The Dôme at the nest, the Loge at the lodge; always 0 on the hunting field. */
  level: number;
}

/** Levels tried, from 0: well above what a player reaches. */
export const MAX_GUESSED_LEVEL = 60;

/**
 * Defenders killed after each exchange, their hp raised by `hpFactor`: each exchange's damage goes to the first units
 * laid until they fall, as in the engine (rounds.ts). Cumulated, like the report's kills added up.
 */
function killsAfter(defenders: number[], hpFactor: number, dealt: readonly number[]): number[] {
  const stacks = UNITS.flatMap((unit, i) => {
    const count = defenders[i] ?? 0;
    return count > 0 ? [{ count, hp: unit.hp * hpFactor, pool: count * unit.hp * hpFactor }] : [];
  });
  return dealt.map((damage) => {
    let left = damage;
    for (const stack of stacks) {
      if (left <= 0) break;
      const taken = Math.min(stack.pool, left);
      stack.pool -= taken;
      left -= taken;
    }
    return stacks.reduce(
      (sum, stack) => sum + Math.min(stack.count, Math.floor(stack.count - stack.pool / stack.hp + EPSILON)),
      0,
    );
  });
}

/**
 * The hp factor fits the report when its kills come back, exchange by exchange. The report rounds each damage to the
 * unit: one damage point less or more on every exchange must still be able to give them.
 */
function fits(defenders: number[], hpFactor: number, exchanges: readonly ReportExchange[]): boolean {
  const reported = exchanges.reduce<number[]>((sums, { killed }) => [...sums, (sums.at(-1) ?? 0) + killed], []);
  const shifted = (shift: number) => exchanges.map(({ dealt }) => Math.max(0, dealt + shift));
  const low = killsAfter(defenders, hpFactor, shifted(-1));
  const high = killsAfter(defenders, hpFactor, shifted(1));
  return reported.every((kills, i) => kills >= (low[i] ?? 0) && kills <= (high[i] ?? 0));
}

/**
 * Every Bouclier (and Dôme at the nest, Loge at the lodge) that gives back the report's kills, the highest Bouclier
 * first. At the nest, two Dôme levels weigh one Bouclier level: the report cannot tell them apart. Empty when no
 * level fits (an army the engine does not know, a rule that differs), and when the highest levels tried still fit:
 * all defenders fell, or none did, and the report bounds the levels on one side only.
 */
export function guessDefenseLevels(
  place: Place,
  defenders: Counts,
  exchanges: readonly ReportExchange[],
): DefenseLevels[] {
  const army = countsToArmy(defenders);
  if (exchanges.length === 0 || army.every((count) => count <= 0)) return [];
  const levels = place === "field" ? [0] : Array.from({ length: MAX_GUESSED_LEVEL + 1 }, (_, i) => i);
  const guesses: DefenseLevels[] = [];
  for (let shield = MAX_GUESSED_LEVEL; shield >= 0; shield--) {
    for (const level of levels) {
      const hpFactor = levelBonus(shield) + placeHpBonus(place, { dome: level, lodge: level });
      if (fits(army, hpFactor, exchanges)) guesses.push({ shield, level });
    }
  }
  const unbounded = guesses.some(
    (guess) => guess.shield === MAX_GUESSED_LEVEL || (place !== "field" && guess.level === MAX_GUESSED_LEVEL),
  );
  return unbounded ? [] : guesses;
}

const PLACE_LEVEL: Record<Place, string> = { field: "", nest: "Dôme", lodge: "Loge" };

/**
 * The guesses in words: « Bouclier 7 », « Bouclier 6 à 8 », « Bouclier 10 et Dôme 14 », « Bouclier 17 et Dôme 0 à
 * Bouclier 0 et Dôme 34 (18 couples) ». Null when none fits.
 */
export function defenseLevelsText(place: Place, guesses: readonly DefenseLevels[]): string | null {
  const first = guesses[0];
  const last = guesses.at(-1);
  if (!first || !last) return null;
  if (place === "field") {
    return first.shield === last.shield
      ? `Bouclier ${String(first.shield)}`
      : `Bouclier ${String(last.shield)} à ${String(first.shield)}`;
  }
  const one = (guess: DefenseLevels) =>
    `Bouclier ${String(guess.shield)} et ${PLACE_LEVEL[place]} ${String(guess.level)}`;
  if (guesses.length === 1) return one(first);
  return `${one(first)} à ${one(last)} (${String(guesses.length)} couples)`;
}

/** With the Bouclier known (shared, guessed elsewhere): the Dôme or Loge levels left, lowest first. */
export const levelsWithShield = (guesses: readonly DefenseLevels[], shield: number): number[] =>
  guesses
    .filter((guess) => guess.shield === shield)
    .map((guess) => guess.level)
    .sort((a, b) => a - b);
