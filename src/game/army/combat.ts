// One hunt fight (rounds: ./rounds.ts). Rules and their checks against real reports: docs/research/chasse.md.
import { PREYS, type Pack } from "./prey";
import { EPSILON, resolveRounds } from "./rounds";
import { levelBonus, UNITS, type Army, type Levels } from "./units";

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

export function fight(army: Army, pack: Pack, levels: Omit<Levels, "huntSpeed">): FightResult {
  const attackBonus = levelBonus(levels.weapons);
  const hpBonus = levelBonus(levels.shield);

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

  const { damageDealt, damageTaken } = resolveRounds(ours, theirs);

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

function promotions(army: Army, pack: Pack, levels: Omit<Levels, "huntSpeed">, survivors: number[]): number[] {
  let preyValue = 0;
  let armyWeight = 0;
  pack.forEach((count, i) => (preyValue += count * (PREYS[i]?.value ?? 0)));
  army.forEach((count, i) => (armyWeight += count * (UNITS[i]?.weight ?? 0)));
  if (armyWeight <= 0) return UNITS.map(() => 0);
  const ratio = (13.2 * preyValue) / (armyWeight * Math.sqrt(levelBonus(levels.shield) * levelBonus(levels.weapons)));
  const share = levelBonus(levels.cochineal) * ratio * ratio;
  return UNITS.map((unit, i) => {
    const left = survivors[i] ?? 0;
    if (!unit.promotesTo || left <= 0) return 0;
    return Math.min(Math.floor(left + EPSILON), Math.floor(share * left + EPSILON));
  });
}
