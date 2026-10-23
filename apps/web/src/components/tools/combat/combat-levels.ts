// « Mes niveaux » in the combat simulator: they fill one side, the visitor's choice (« Mes niveaux : attaquant /
// défenseur »). See docs/features/site-combat.md.
import type { SimulatorForm } from "@optizzz/game/army/battle-form";
import type { CombatSide, CombatToolState } from "@optizzz/game/site-links/combat";
import type { MyLevelKey, MyLevels } from "../my-levels";

/** The levels each side asks for. */
export const SIDE_LEVELS = {
  attack: ["weapons", "shield", "aphids"],
  defend: ["weapons", "shield", "dome", "lodge"],
} as const satisfies Record<CombatSide, readonly MyLevelKey[]>;

type AttackLevel = (typeof SIDE_LEVELS.attack)[number];
type DefendLevel = (typeof SIDE_LEVELS.defend)[number];

/** The side's level fields with the known levels of `levels`; an unknown level leaves its field as it is. */
export function withLevels(form: SimulatorForm, side: CombatSide, levels: MyLevels): SimulatorForm {
  const known = <Key extends MyLevelKey>(keys: readonly Key[]) =>
    Object.fromEntries(keys.flatMap((key) => (levels[key] === undefined ? [] : [[key, levels[key]]]))) as Partial<
      Record<Key, number>
    >;
  return side === "attack"
    ? { ...form, attacker: { ...form.attacker, ...known<AttackLevel>(SIDE_LEVELS.attack) } }
    : { ...form, defender: { ...form.defender, ...known<DefendLevel>(SIDE_LEVELS.defend) } };
}

/** What the side's level fields hold, for « Mes niveaux ». */
export function sideLevels(form: SimulatorForm, side: CombatSide): MyLevels {
  return side === "attack"
    ? Object.fromEntries(SIDE_LEVELS.attack.map((key) => [key, form.attacker[key]]))
    : Object.fromEntries(SIDE_LEVELS.defend.map((key) => [key, form.defender[key]]));
}

/** « Mes niveaux » now fill `side`: the levels known go there. */
export function chooseMySide(state: CombatToolState, side: CombatSide, mine: MyLevels | null): CombatToolState {
  return { form: mine ? withLevels(state.form, side, mine) : state.form, mine: side };
}
