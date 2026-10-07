// One hunt fight, round by round. Rules and their checks against real reports: docs/research/chasse.md.
import { PREYS, type Pack } from "./prey";
import { UNITS, type Army, type Levels } from "./units";

export interface FightResult {
  win: boolean;
  /** Our first-round damage, Weapons bonus included (the report's « Vous infligez »). */
  damageDealt: number;
  /** Damage the prey dealt over the whole fight (the report rounds it up). */
  damageTaken: number;
  /** Units that fell to 0 hp, as the report counts them. */
  reportedDead: number[];
  /** Units that do not come back: dead, or wounded past half their hp. A lost fight loses everything. */
  lost: number[];
  /** Units promoted, by the type they were (JSN → SN counts in the JSN slot). */
  promoted: number[];
}

const MAX_ROUNDS = 500;
const EPSILON = 1e-9;

/** First round only: crushing the prey cuts their damage. */
function overkillFactor(ratio: number): number {
  if (ratio > 3) return 0.1;
  if (ratio > 2) return 0.3;
  if (ratio > 1.5) return 0.5;
  return 1;
}

export function fight(army: Army, pack: Pack, levels: Omit<Levels, "huntSpeed">): FightResult {
  const attackBonus = 1 + 0.1 * levels.weapons;
  const hpBonus = 1 + 0.1 * levels.shield;

  // Each side is a list of stacks; a stack's pool is its remaining hp.
  const ours = UNITS.flatMap((unit, i) => {
    const count = army[i] ?? 0;
    if (count <= 0) return [];
    const hp = unit.hp * hpBonus;
    return [{ i, count, hp, attack: unit.attack * attackBonus, pool: count * hp }];
  });
  const theirs = PREYS.flatMap((prey, i) => {
    const count = pack[i] ?? 0;
    return count > 0 ? [{ hp: prey.hp, attack: prey.damage, pool: count * prey.hp }] : [];
  });

  let damageDealt = 0;
  let damageTaken = 0;
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    let ourDamage = 0;
    let theirDamage = 0;
    let theirHp = 0;
    for (const stack of ours) ourDamage += (stack.pool / stack.hp) * stack.attack;
    for (const stack of theirs) {
      theirDamage += (stack.pool / stack.hp) * stack.attack;
      theirHp += stack.pool;
    }
    if (ourDamage <= EPSILON || theirHp <= EPSILON) break;
    if (round === 1) {
      damageDealt = ourDamage;
      if (ourDamage >= theirHp) theirDamage *= overkillFactor(ourDamage / theirHp);
    }
    damageTaken += Math.min(
      theirDamage,
      ours.reduce((sum, stack) => sum + stack.pool, 0),
    );
    applyDamage(theirs, ourDamage);
    applyDamage(ours, theirDamage);
  }

  const win = theirs.every((stack) => stack.pool <= EPSILON) && ours.some((stack) => stack.pool > EPSILON);
  const reportedDead = UNITS.map(() => 0);
  const lost = UNITS.map(() => 0);
  const survivors = UNITS.map(() => 0);
  for (const stack of ours) {
    const fallen = stack.count - stack.pool / stack.hp;
    reportedDead[stack.i] = win ? Math.min(stack.count, Math.floor(fallen + EPSILON)) : stack.count;
    lost[stack.i] = win ? Math.min(stack.count, Math.floor(fallen + 0.5 - EPSILON)) : stack.count;
    survivors[stack.i] = win ? stack.pool / stack.hp : 0;
  }
  const promoted = win ? promotions(army, pack, levels, survivors) : UNITS.map(() => 0);
  return { win, damageDealt, damageTaken, reportedDead, lost, promoted };
}

/** Damage goes to the first stack of the list until it is dead, then to the next. */
function applyDamage(stacks: { pool: number }[], damage: number) {
  let left = damage;
  for (const stack of stacks) {
    if (left <= 0) break;
    const taken = Math.min(stack.pool, left);
    stack.pool -= taken;
    left -= taken;
  }
}

function promotions(army: Army, pack: Pack, levels: Omit<Levels, "huntSpeed">, survivors: number[]): number[] {
  let preyValue = 0;
  let armyWeight = 0;
  pack.forEach((count, i) => (preyValue += count * (PREYS[i]?.value ?? 0)));
  army.forEach((count, i) => (armyWeight += count * (UNITS[i]?.weight ?? 0)));
  if (armyWeight <= 0) return UNITS.map(() => 0);
  const ratio = (13.2 * preyValue) / (armyWeight * Math.sqrt((1 + 0.1 * levels.shield) * (1 + 0.1 * levels.weapons)));
  const share = (1 + 0.1 * levels.cochineal) * ratio * ratio;
  return UNITS.map((unit, i) => {
    const left = survivors[i] ?? 0;
    if (!unit.promotesTo || left <= 0) return 0;
    return Math.min(Math.floor(left + EPSILON), Math.floor(share * left + EPSILON));
  });
}
