// Who can attack whom, both ways, for a profile and an alliance. See docs/features/analyse-joueurs.md.
import { inRange } from "../attack";
import { distance } from "../travel";

/** Whether I can attack the player, and whether they can attack me. */
export interface MutualReach {
  iCanAttack: boolean;
  canAttackMe: boolean;
}

export function mutualReach(myField: number, theirField: number): MutualReach {
  return { iCanAttack: inRange(myField, theirField), canAttackMe: inRange(theirField, myField) };
}

interface Nest {
  field: number;
  x: number;
  y: number;
}

/** How a player stands against an alliance's members: who can attack them, whom they can attack, the nearest attacker. */
export interface AllianceReach {
  canAttackIt: number;
  itCanAttack: number;
  /** The nearest member who can attack the player, distance in squares. */
  nearestAttacker: { pseudo: string; distance: number } | null;
}

export function allianceReach(target: Nest, members: readonly (Nest & { pseudo: string })[]): AllianceReach {
  const attackers = members.filter((member) => inRange(member.field, target.field));
  const nearest = attackers
    .map((member) => ({ pseudo: member.pseudo, distance: distance(member, target) }))
    .sort((a, b) => a.distance - b.distance)[0];
  return {
    canAttackIt: attackers.length,
    itCanAttack: members.filter((member) => inRange(target.field, member.field)).length,
    nearestAttacker: nearest ?? null,
  };
}
