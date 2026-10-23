// What the site's hunt simulator does with its entries besides asking the engine: « Mes niveaux », the advanced
// settings the simple display mentions, the hunts changed by hand. See docs/features/site-chasse.md.
import { armyToCounts } from "@optizzz/game/army/army-text";
import { UNITS } from "@optizzz/game/army/units";
import type { EditedHunt, HuntForm } from "@optizzz/game/hunt/hunt-form";
import type { Plan } from "@optizzz/game/hunt/planner";
import { formatNumber } from "@optizzz/game/format/number-format";
import type { MyLevelKey, MyLevels } from "../my-levels";

/** The levels the plan needs, then those of the laying speed (optional). */
const HUNT_LEVELS = ["weapons", "shield", "huntSpeed", "cochineal"] as const satisfies readonly MyLevelKey[];
const LAYING_LEVELS = ["nursery", "solarium", "laying"] as const satisfies readonly MyLevelKey[];

export type HuntLevelKey = (typeof HUNT_LEVELS)[number];
export type LayingLevelKey = (typeof LAYING_LEVELS)[number];

const known = <Key extends MyLevelKey>(keys: readonly Key[], mine: MyLevels) =>
  Object.fromEntries(keys.flatMap((key) => (mine[key] === undefined ? [] : [[key, mine[key]]]))) as Partial<
    Record<Key, number>
  >;

/** The level fields with the known levels of `mine`; an unknown level leaves its field as it is. */
export function withLevels(form: HuntForm, mine: MyLevels): HuntForm {
  return {
    ...form,
    levels: { ...form.levels, ...known(HUNT_LEVELS, mine) },
    laying: { ...form.laying, ...known(LAYING_LEVELS, mine) },
  };
}

/** What the advanced settings change that the simple display does not show, as short phrases. */
export function advancedSettings(form: HuntForm): string[] {
  const { huntCount, huntAmount } = form;
  return [
    ...(form.arrivalField !== null && form.arrivalField !== form.launchField ? ["TdC à l'arrivée changé"] : []),
    ...(form.takenSlots > 0
      ? [`${String(form.takenSlots)} chasse${form.takenSlots > 1 ? "s" : ""} déjà en cours`]
      : []),
    ...(huntCount !== null
      ? [`${String(huntCount)} chasse${huntCount > 1 ? "s" : ""} imposée${huntCount > 1 ? "s" : ""}`]
      : []),
    ...(huntAmount !== null ? [`${formatNumber(huntAmount)} cm² par chasse imposés`] : []),
    ...(form.edited ? ["chasses changées à la main"] : []),
  ];
}

/** A change to one hunt of the table: its surface, or the count of one unit. */
export type HuntEdit = { amount: number } | { unit: string; count: number };

/** The hunts of `plan` (as shown) with one of them changed. */
export function editHunt(plan: Plan, index: number, edit: HuntEdit): EditedHunt[] {
  return plan.hunts.map((hunt, i) => {
    if (i !== index) return { amount: hunt.amount, army: armyToCounts(hunt.army) };
    if ("amount" in edit) return { amount: edit.amount, army: armyToCounts(hunt.army) };
    const army = UNITS.map((unit, u) => (unit.key === edit.unit ? edit.count : (hunt.army[u] ?? 0)));
    return { amount: hunt.amount, army: armyToCounts(army) };
  });
}
