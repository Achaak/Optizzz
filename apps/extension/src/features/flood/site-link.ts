// « Ouvrir sur optizzz.fr » and « Copier le lien » of the flood plan: the site's flood simulator with what this plan
// used, so that it gives the same attacks. See docs/features/site-flood.md.
import type { FloodPlanInput } from "@optizzz/game/flood";
import { EMPTY_FLOOD, floodLinkFormat } from "@optizzz/game/site-links/flood";
import { UNITS } from "@optizzz/game/army/units";

export interface FloodLinkInput {
  /** What the plan was made with: both fields after the attacks on their way, the army it sends. */
  plan: FloodPlanInput;
  attackSpeed: number;
  /** My attacks on their way, with the plan or without it: the slots they take. */
  underWay: number;
}

/** The encoded state of the site's tool (`1.<base64url>`), without server nor players: the fields are given. */
export function floodSiteState({ plan, attackSpeed, underWay }: FloodLinkInput): string {
  return floodLinkFormat.encode({
    ...EMPTY_FLOOD,
    attackerField: plan.attackerField,
    targetField: plan.targetField,
    army: UNITS.map((_, i) => plan.available[i] ?? 0),
    attackSpeed,
    weapons: plan.levels.weapons,
    shield: plan.levels.shield,
    underWay,
    defense: plan.defense && UNITS.map((_, i) => plan.defense?.[i] ?? 0),
  });
}
