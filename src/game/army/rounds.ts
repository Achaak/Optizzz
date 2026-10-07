// The round-by-round exchange shared by hunts and fights between players (official help, « Les Combats »).

/** Units of one type: `pool` is their remaining hp; `attack` the damage one deals per round. */
export interface Stack {
  hp: number;
  attack: number;
  pool: number;
}

export interface RoundsResult {
  /** The striking side's first-round damage (the report's « Vous infligez »). */
  damageDealt: number;
  /** Damage the struck side dealt back over the whole fight. */
  damageTaken: number;
  /** Share of its damage the struck side dealt in the first round: 1, or 0.5 / 0.3 / 0.1 when crushed. */
  reply: number;
}

const MAX_ROUNDS = 500;
export const EPSILON = 1e-9;

/** First round only: dealing 1.5, 2 or 3 times the defenders' hp cuts their reply to 50, 30 or 10 %. */
export function overkillFactor(ratio: number): number {
  if (ratio > 3) return 0.1;
  if (ratio > 2) return 0.3;
  if (ratio > 1.5) return 0.5;
  return 1;
}

/** Damage goes to the first stack of the list until it is dead, then to the next. */
function applyDamage(stacks: Stack[], damage: number) {
  let left = damage;
  for (const stack of stacks) {
    if (left <= 0) break;
    const taken = Math.min(stack.pool, left);
    stack.pool -= taken;
    left -= taken;
  }
}

/**
 * Both sides strike at once each round, with their survivors (fractional: remaining hp / hp of one), until the
 * striking side has no damage left or the struck side is dead. Pools are updated in place.
 */
export function resolveRounds(striking: Stack[], struck: Stack[]): RoundsResult {
  let damageDealt = 0;
  let damageTaken = 0;
  let reply = 1;
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    let ourDamage = 0;
    let theirDamage = 0;
    let theirHp = 0;
    for (const stack of striking) ourDamage += (stack.pool / stack.hp) * stack.attack;
    for (const stack of struck) {
      theirDamage += (stack.pool / stack.hp) * stack.attack;
      theirHp += stack.pool;
    }
    if (ourDamage <= EPSILON || theirHp <= EPSILON) break;
    if (round === 1) {
      damageDealt = ourDamage;
      if (ourDamage >= theirHp) reply = overkillFactor(ourDamage / theirHp);
      theirDamage *= reply;
    }
    damageTaken += Math.min(
      theirDamage,
      striking.reduce((sum, stack) => sum + stack.pool, 0),
    );
    applyDamage(struck, ourDamage);
    applyDamage(striking, theirDamage);
  }
  return { damageDealt, damageTaken, reply };
}
