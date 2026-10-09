// Rules of an attack between players, shared by the combat simulator, the flood plan, the targets and the TDC chain.
// Sources: tutorial « Attaque », Toolzzz; see docs/research/combat.md.

/** What a won attack takes on the hunting field: 20 % of the defender's field, one cm² per surviving ant at most. */
export const maxTake = (defenderField: number) => Math.floor(defenderField * 0.2);

/**
 * Whether `attacker` may attack `defender`: from 50 % (included) to 300 % (excluded) of its field. `margin` keeps the
 * target that much above the 50 % limit, e.g. 0.01 for 1 %: other moves may change the fields before arrival.
 */
export const inRange = (attackerField: number, defenderField: number, margin = 0) =>
  defenderField * 2 >= attackerField * (1 + margin) && defenderField < attackerField * 3;

/** The largest take after which the target is still in range of the attacker, with the margin, for a next attack. */
export const takeAtLimit = (attackerField: number, targetField: number, margin: number) =>
  Math.floor((2 * targetField - (1 + margin) * attackerField) / (3 + margin));

/** Attacks that can still leave: Attack Speed + 1 under way at once (the game's flood simulator, docs/research/combat.md). */
export const attackSlots = (attackSpeed: number, underWay: number) => Math.max(0, attackSpeed + 1 - underWay);
