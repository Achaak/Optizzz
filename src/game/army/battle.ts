// A fight between players. Rules, sources and what is not verified yet: docs/research/combat.md.
import { EPSILON, resolveRounds, type Stack } from "./rounds";
import { levelBonus, UNITS, type Army } from "./units";
import { maxTake } from "../attack";

/** Hunting field, nest (Fourmilière, Dôme bonus), imperial lodge (Loge Impériale). */
export type Place = "field" | "nest" | "lodge";
export const PLACES: readonly Place[] = ["field", "nest", "lodge"];

export interface Attacker {
  army: Army;
  weapons: number;
  shield: number;
}

export interface Defender {
  armies: Record<Place, Army>;
  weapons: number;
  shield: number;
  /** Dôme level: the nest's hp bonus. */
  dome: number;
  /** Loge Impériale level: the lodge's hp bonus. */
  lodge: number;
}

export interface Stage {
  place: Place;
  won: boolean;
  /** Share of their damage the defenders dealt in the first round. */
  reply: number;
  /** The attacker's first-round damage. */
  damageDealt: number;
  /** Damage the defenders dealt over the fight. */
  damageTaken: number;
  attackerBefore: number[];
  attackerLost: number[];
  defenderBefore: number[];
  defenderLost: number[];
}

export interface BattleResult {
  stages: Stage[];
  won: boolean;
  /** The attacker's army after the last stage fought. */
  survivors: number[];
}

/** Hp bonus of the defenders of a place, on top of the Shield's. */
export function placeHpBonus(place: Place, defender: Pick<Defender, "dome" | "lodge">): number {
  if (place === "nest") return 0.1 + 0.05 * defender.dome;
  if (place === "lodge") return 0.3 + 0.15 * defender.lodge;
  return 0;
}

const stacksOf = (army: Army, damage: (i: number) => number, hpBonus: number) =>
  UNITS.flatMap((unit, i) => {
    const count = army[i] ?? 0;
    if (count <= 0) return [];
    const hp = unit.hp * hpBonus;
    return [{ i, count, hp, attack: damage(i), pool: count * hp }];
  });

/** Units that fell to 0 hp; the whole side when it lost. */
const fallen = (stacks: (Stack & { i: number; count: number })[], lostAll: boolean) => {
  const counts = UNITS.map(() => 0);
  for (const stack of stacks) {
    counts[stack.i] = lostAll
      ? stack.count
      : Math.min(stack.count, Math.floor(stack.count - stack.pool / stack.hp + EPSILON));
  }
  return counts;
};

/**
 * The attack on `target`: on the hunting field first, then in the nest, then in the lodge (official help), the
 * survivors going on. The attacker strikes with its attack, the defenders with their defense; Weapons raise both.
 */
export function battle(attacker: Attacker, defender: Defender, target: Place): BattleResult {
  const stages: Stage[] = [];
  let army = UNITS.map((_, i) => attacker.army[i] ?? 0);
  for (const place of PLACES.slice(0, PLACES.indexOf(target) + 1)) {
    const ours = stacksOf(
      army,
      (i) => (UNITS[i]?.attack ?? 0) * levelBonus(attacker.weapons),
      levelBonus(attacker.shield),
    );
    const theirs = stacksOf(
      defender.armies[place],
      (i) => (UNITS[i]?.defense ?? 0) * levelBonus(defender.weapons),
      levelBonus(defender.shield) + placeHpBonus(place, defender),
    );
    const rounds = resolveRounds(ours, theirs);
    const won = theirs.every((stack) => stack.pool <= EPSILON) && ours.some((stack) => stack.pool > EPSILON);
    const attackerLost = fallen(ours, !won);
    stages.push({
      place,
      won,
      reply: rounds.reply,
      damageDealt: rounds.damageDealt,
      damageTaken: rounds.damageTaken,
      attackerBefore: army,
      attackerLost,
      defenderBefore: UNITS.map((_, i) => defender.armies[place][i] ?? 0),
      defenderLost: fallen(theirs, won),
    });
    army = army.map((count, i) => count - (attackerLost[i] ?? 0));
    if (!won) break;
  }
  return { stages, won: stages.every((stage) => stage.won), survivors: army };
}

/** First-round damage needed to cut the defenders' reply to 50, 30 and 10 %. */
export function requiredAttack(army: Army, shield: number, placeBonus: number) {
  const hp = UNITS.reduce((sum, unit, i) => sum + (army[i] ?? 0) * unit.hp, 0) * (levelBonus(shield) + placeBonus);
  return { half: hp * 1.5, thirty: hp * 2, ten: hp * 3 };
}

export interface Spoils {
  /** Hunting field taken, cm². */
  field: number;
  food: number;
  materials: number;
  colony: boolean;
}

export interface SpoilsInput {
  /** The attacker's Weapons and Étable à pucerons levels. */
  weapons: number;
  aphids: number;
  /** The defender's hunting field and stocks. */
  field: number;
  food: number;
  materials: number;
}

/**
 * What a won attack takes (official help): 20 % of the hunting field, one cm² per surviving ant at most; from the
 * nest, 30 % + 1 % per aphid stable level of each resource, one per surviving attack point at most; the lodge
 * makes a colony.
 */
export function spoils(result: BattleResult, target: Place, input: SpoilsInput): Spoils {
  if (!result.won) return { field: 0, food: 0, materials: 0, colony: false };
  const ants = result.survivors.reduce((sum, count) => sum + count, 0);
  const field = Math.min(maxTake(input.field), ants);
  if (target !== "nest") return { field, food: 0, materials: 0, colony: target === "lodge" };

  const share = 0.3 + 0.01 * input.aphids;
  let food = Math.floor(share * input.food);
  let materials = Math.floor(share * input.materials);
  const attack =
    UNITS.reduce((sum, unit, i) => sum + (result.survivors[i] ?? 0) * unit.attack, 0) * levelBonus(input.weapons);
  if (food + materials > attack) {
    const scale = attack / (food + materials);
    food = Math.floor(food * scale);
    materials = Math.floor(materials * scale);
  }
  return { field, food, materials, colony: false };
}
