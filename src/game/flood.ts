import { battle, type Defender } from "./army/battle";
import { UNITS, type Army } from "./army/units";
import { inRange, maxTake, takeAtLimit } from "./attack";

// A flood: several attacks on the same hunting field, each taking 20 % of what is left.
// Rules (tutorial « Attaque », Toolzzz): a won attack takes min(ants, floor(20 % of the target's field)); the
// 50 %–300 % range is checked again at each arrival, both fields having moved. See docs/research/combat.md.

export interface FloodInput {
  /** My hunting field, cm². */
  attackerField: number;
  targetField: number;
  /** Attacks I can still launch. */
  slots: number;
  /** Ants I can send, all waves together. */
  ants: number;
  /** Kept above the 50 % limit, e.g. 0.01 for 1 %: other moves may change the fields before arrival. */
  margin: number;
}

export interface Wave {
  ants: number;
  take: number;
  attackerAfter: number;
  targetAfter: number;
}

/**
 * The waves that take the most: 20 % each while the target stays in range for the next one; when a full take
 * would put it out of range and a slot is left, the largest take that keeps it at the limit, then a last 20 %.
 */
export function planFlood(input: FloodInput): Wave[] {
  const waves: Wave[] = [];
  let attacker = input.attackerField;
  let target = input.targetField;
  let ants = input.ants;
  let slots = input.slots;

  // Every wave keeps the margin, the first one too: the fields may move before it lands.
  while (slots > 0 && ants > 0 && inRange(attacker, target, input.margin)) {
    const full = maxTake(target);
    let take = full;
    let last = false;
    if (slots > 1 && !inRange(attacker + full, target - full, input.margin)) {
      const limit = takeAtLimit(attacker, target, input.margin);
      if (limit > 0) take = limit;
      else last = true;
    }
    take = Math.min(take, ants);
    if (take <= 0) break;
    attacker += take;
    target -= take;
    ants -= take;
    slots -= 1;
    waves.push({ ants: take, take, attackerAfter: attacker, targetAfter: target });
    if (last) break;
  }
  return waves;
}

export interface FirstWave {
  /** Units sent, per `UNITS` index. */
  army: number[];
  /** Ants left after the fight: they cap the take (one cm² each). */
  survivors: number;
  lost: number[];
}

/** Indexes of `UNITS`, strongest attack first. */
const STRONGEST_FIRST = UNITS.map((unit, i) => ({ attack: unit.attack, i }))
  .sort((a, b) => b.attack - a.attack)
  .map(({ i }) => i);

/** The first `count` ants of `available`, strongest first. */
function strongest(available: Army, count: number): number[] {
  const army = UNITS.map(() => 0);
  let left = count;
  for (const i of STRONGEST_FIRST) {
    const sent = Math.min(left, available[i] ?? 0);
    army[i] = sent;
    left -= sent;
  }
  return army;
}

/**
 * Against defenders on the hunting field: the smallest army, strongest units first, that wins with their reply cut
 * to 10 % (official help: more than 3 times their hp in the first round). Null when my army is not enough.
 */
export function firstWave(
  available: Army,
  defender: Defender,
  levels: { weapons: number; shield: number },
): FirstWave | null {
  const attack = (count: number) => {
    const army = strongest(available, count);
    const result = battle({ army, ...levels }, defender, "field");
    const stage = result.stages[0];
    return { army, result, crushes: result.won && stage !== undefined && stage.reply <= 0.1 };
  };
  const total = available.reduce((sum, count) => sum + count, 0);
  if (!attack(total).crushes) return null;
  let low = 0;
  let high = total;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (attack(middle).crushes) high = middle;
    else low = middle;
  }
  const { army, result } = attack(high);
  const lost = result.stages[0]?.attackerLost ?? UNITS.map(() => 0);
  return { army, survivors: result.survivors.reduce((sum, count) => sum + count, 0), lost };
}

export interface PlannedAttack extends Wave {
  /** Units sent, per `UNITS` index. */
  army: number[];
  /** Expected losses, against a defense only. */
  lost: number[] | null;
}

export interface AttacksInput extends Omit<FloodInput, "ants"> {
  /** Units I can send, per `UNITS` index. */
  available: Army;
  /** The target's army, when known; null to assume nobody defends its hunting field. */
  defender: Defender | null;
  /** My Weapons and Shield levels. */
  levels: { weapons: number; shield: number };
}

/** Indexes of `UNITS`, cheapest first: without defenders every ant takes one cm², whatever it is. */
const CHEAPEST_FIRST = UNITS.map((unit, i) => ({ food: unit.food, i }))
  .sort((a, b) => a.food - b.food)
  .map(({ i }) => i);

/** Takes `count` ants out of `pool` (changed in place), cheapest first. */
function takeCheapest(pool: number[], count: number): number[] {
  const army = UNITS.map(() => 0);
  let left = count;
  for (const i of CHEAPEST_FIRST) {
    const sent = Math.min(left, pool[i] ?? 0);
    army[i] = sent;
    pool[i] = (pool[i] ?? 0) - sent;
    left -= sent;
  }
  return army;
}

const sum = (army: Army) => army.reduce((total, count) => total + count, 0);

/**
 * The flood with its units. Against known defenders on the hunting field, the first attack crushes them
 * (`firstWave`), the next ones meet nobody. `blocked` when my army cannot beat them.
 */
export function planAttacks(input: AttacksInput): { attacks: PlannedAttack[]; blocked: boolean } {
  const pool = UNITS.map((_, i) => input.available[i] ?? 0);
  const attacks: PlannedAttack[] = [];
  let attacker = input.attackerField;
  let target = input.targetField;
  let slots = input.slots;

  if (input.defender && sum(input.defender.armies.field) > 0 && slots > 0 && inRange(attacker, target, input.margin)) {
    const opening = firstWave(pool, input.defender, input.levels);
    if (!opening) return { attacks: [], blocked: true };
    const take = Math.min(opening.survivors, maxTake(target));
    attacker += take;
    target -= take;
    slots -= 1;
    opening.army.forEach((count, i) => (pool[i] = (pool[i] ?? 0) - count));
    attacks.push({
      ants: sum(opening.army),
      take,
      attackerAfter: attacker,
      targetAfter: target,
      army: opening.army,
      lost: opening.lost,
    });
  }

  const waves = planFlood({
    attackerField: attacker,
    targetField: target,
    slots,
    ants: sum(pool),
    margin: input.margin,
  });
  for (const wave of waves) attacks.push({ ...wave, army: takeCheapest(pool, wave.ants), lost: null });
  return { attacks, blocked: false };
}
