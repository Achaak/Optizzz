// The entries of the hunt simulator, as the site's tool keeps them and the extension's launcher hands them over
// (« Ouvrir sur optizzz.fr »): both ask the engine the same plan from them. See docs/features/site-chasse.md.
import { countsToArmy, type Counts } from "../army/army-text";
import { UNITS, type Levels } from "../army/units";
import { LAYING_FACTOR } from "../laying-boost";
import type { Draft, Objective, PlanInput } from "./planner";

/** A level not known yet is null: never 0 assumed. */
export type HuntLevelFields = Record<keyof Levels, number | null>;

/** Couveuse, Solarium and Technique de ponte: the queen's laying speed, to show losses as laying time. */
export interface LayingLevelFields {
  nursery: number | null;
  solarium: number | null;
  laying: number | null;
}

/** A hunt changed by hand: its surface and units. */
export interface EditedHunt {
  amount: number;
  army: Counts;
}

export interface HuntForm {
  /** Units sent hunting. */
  army: Counts;
  levels: HuntLevelFields;
  laying: LayingLevelFields;
  /** Hunting field when the hunts leave: it sets their duration. */
  launchField: number | null;
  /** Hunting field when the first hunt fights; null: the one at launch. */
  arrivalField: number | null;
  /** Hunts already away: their slots are taken. */
  takenSlots: number;
  objective: Objective["kind"];
  /** « Ratio »: attack / difficulty. */
  ratio: number;
  /** « Rendement »: losses accepted (9 times out of 10), share of the food value of the units sent. */
  maxLossShare: number;
  dispatch: "mix" | "waves";
  /** Null: the planner chooses. */
  huntCount: number | null;
  huntAmount: number | null;
  /** Hunts changed by hand, in launch order; null: the plan computed. */
  edited: EditedHunt[] | null;
}

/** The extension's defaults (« Équilibré »). */
export const emptyHuntForm = (): HuntForm => ({
  army: {},
  levels: { weapons: null, shield: null, huntSpeed: null, cochineal: null },
  laying: { nursery: null, solarium: null, laying: null },
  launchField: null,
  arrivalField: null,
  takenSlots: 0,
  objective: "ratio",
  ratio: 8,
  maxLossShare: 0.01,
  dispatch: "mix",
  huntCount: null,
  huntAmount: null,
  edited: null,
});

/** The four levels, once all are known. */
export function knownLevels(levels: HuntLevelFields): Levels | null {
  const { weapons, shield, huntSpeed, cochineal } = levels;
  if (weapons === null || shield === null || huntSpeed === null || cochineal === null) return null;
  return { weapons, shield, huntSpeed, cochineal };
}

/** Free hunt slots: Vitesse de chasse + 1, less the hunts away. */
export const freeSlots = (huntSpeed: number, takenSlots: number) => Math.max(0, huntSpeed + 1 - takenSlots);

/** Factor of the units' laying times, 0.9 per level of the three (docs/features/conseils-recherche.md); null if one is missing. */
export function layingSpeed({ nursery, solarium, laying }: LayingLevelFields): number | null {
  if (nursery === null || solarium === null || laying === null) return null;
  return LAYING_FACTOR ** (nursery + solarium + laying);
}

/** What is missing before a plan can be computed, in the words of the form; empty when nothing is. */
export function missingEntries(form: HuntForm): string[] {
  return [
    ...(knownLevels(form.levels) ? [] : ["vos niveaux"]),
    ...(form.launchField === null || form.launchField < 1 ? ["votre TDC"] : []),
    ...(UNITS.some((unit) => (form.army[unit.key] ?? 0) > 0) ? [] : ["l'armée envoyée"]),
  ];
}

/** Everything but the objective and the surface: what the ratio list is computed from. Null while entries are missing. */
export function baseInput(form: HuntForm): Omit<PlanInput, "objective"> | null {
  const levels = knownLevels(form.levels);
  if (!levels || form.launchField === null || form.launchField < 1 || missingEntries(form).length > 0) return null;
  const slots = freeSlots(levels.huntSpeed, form.takenSlots);
  return {
    army: countsToArmy(form.army),
    field: form.arrivalField ?? form.launchField,
    fieldAtLaunch: form.launchField,
    slots,
    levels,
    ...(form.huntCount === null ? {} : { huntCount: Math.min(form.huntCount, Math.max(1, slots)) }),
  };
}

/** The engine's input for the plan: the same for the site and the launcher, hence the same plan. */
export function planInput(form: HuntForm): PlanInput | null {
  const base = baseInput(form);
  if (!base) return null;
  const objective: Objective =
    form.objective === "ratio"
      ? { kind: "ratio", ratio: form.ratio }
      : { kind: "yield", maxLossShare: form.maxLossShare };
  return {
    ...base,
    objective,
    dispatch: form.dispatch,
    ...(form.huntAmount === null ? {} : { huntAmount: form.huntAmount }),
  };
}

/** Hunts in launch order, each fighting at the field the previous ones leave. */
export function chainDrafts(field: number, hunts: readonly { amount: number; army: readonly number[] }[]): Draft[] {
  let at = field;
  return hunts.map((hunt) => {
    const draft = { amount: hunt.amount, field: at, army: [...hunt.army] };
    at += hunt.amount;
    return draft;
  });
}
