// Choosing how many hunts, how big, and with which units. Decisions: docs/features/hunt-launcher.md.
import { calysteneEstimate, type CalysteneEstimate } from "./calystene";
import { difficulty, huntDurationSeconds } from "./difficulty";
import { evaluateHunt, type HuntOutcome } from "./evaluate";
import { armyAttack, armyFood, type Army, type Levels } from "./units";

// No « zero loss » objective: young dwarves take the hits first, and the fixed 0.01 × field part of the
// difficulty wounds one past half its hp at any sizeable field. See docs/research/chasse.md.
export type Objective =
  /** Losses (9 times out of 10) up to a share of the food value of the units sent. */
  | { kind: "yield"; maxLossShare: number }
  /** Attack / difficulty at least `ratio`, as in Calystene's simulator. */
  | { kind: "ratio"; ratio: number };

export interface PlanInput {
  /** Units that may go hunting (reserve already taken out). */
  army: Army;
  /** Hunting field the first hunt will fight at. */
  field: number;
  /** Hunting field now: it sets the duration. */
  fieldAtLaunch: number;
  /** Free hunt slots. */
  slots: number;
  levels: Levels;
  objective: Objective;
  /** Force the number of hunts instead of choosing the best. */
  huntCount?: number;
  /** Prey draws per surface while searching, and for the plan shown. */
  searchSamples?: number;
  finalSamples?: number;
}

export interface PlannedHunt {
  amount: number;
  /** Hunting field at fight time. */
  field: number;
  army: number[];
  armyFood: number;
  attack: number;
  difficulty: number;
  outcome: HuntOutcome;
  calystene: CalysteneEstimate;
  durationSeconds: number;
}

export interface Plan {
  hunts: PlannedHunt[];
  totalAmount: number;
  /** Until the last hunt is back. */
  durationSeconds: number;
  fieldPerHour: number;
}

const DEFAULT_SEARCH_SAMPLES = 1000;
const DEFAULT_FINAL_SAMPLES = 10_000;
const MIN_WIN_CHANCE = 0.99;
/** Different surfaces per hunt are only offered when they conquer this much more per hour. */
const UNEQUAL_GAIN = 1.03;
const MAX_FINAL_RETRIES = 25;

const NO_OUTCOME = evaluateHunt({
  army: [],
  field: 0,
  amount: 0,
  levels: { weapons: 0, shield: 0, huntSpeed: 0, cochineal: 0 },
  samples: 0,
});

export const EMPTY_PLAN: Plan = { hunts: [], totalAmount: 0, durationSeconds: 0, fieldPerHour: 0 };

/** Splits each unit type by weight; rounding leftovers go to the last (hardest) hunts. */
export function splitArmy(army: Army, weights: readonly number[]): number[][] {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const shares = weights.map(() => army.map(() => 0));
  army.forEach((count, unit) => {
    let given = 0;
    weights.forEach((weight, hunt) => {
      const share = Math.floor((count * weight) / totalWeight);
      (shares[hunt] ?? [])[unit] = share;
      given += share;
    });
    for (let hunt = weights.length - 1; given < count; hunt = hunt > 0 ? hunt - 1 : weights.length - 1) {
      const row = shares[hunt] ?? [];
      row[unit] = (row[unit] ?? 0) + 1;
      given++;
    }
  });
  return shares;
}

export interface Draft {
  amount: number;
  field: number;
  army: number[];
}

function withinObjective(draft: Draft, input: PlanInput, outcome: HuntOutcome): boolean {
  const { objective, levels } = input;
  switch (objective.kind) {
    case "ratio":
      return armyAttack(draft.army, levels) / difficulty(draft.field, draft.amount) >= objective.ratio;
    case "yield":
      return (
        outcome.winChance >= MIN_WIN_CHANCE && outcome.lossFood.p90 <= objective.maxLossShare * armyFood(draft.army)
      );
  }
}

/** Ratio hunts need no simulation to be checked. */
function meets(draft: Draft, input: PlanInput, samples: number): boolean {
  const outcome =
    input.objective.kind === "ratio" ? NO_OUTCOME : evaluateHunt({ ...draft, levels: input.levels, samples });
  return withinObjective(draft, input, outcome);
}

/** Hardest hunts first: they fail first, which ends the check early. */
function allMeet(drafts: Draft[], input: PlanInput, samples: number): boolean {
  for (let i = drafts.length - 1; i >= 0; i--) {
    const draft = drafts[i];
    if (!draft || !meets(draft, input, samples)) return false;
  }
  return true;
}

export function equalDrafts(input: PlanInput, count: number, amount: number): Draft[] {
  const fields = Array.from({ length: count }, (_, i) => input.field + i * amount);
  const armies = splitArmy(
    input.army,
    fields.map((field) => difficulty(field, amount)),
  );
  return fields.map((field, i) => ({ amount, field, army: armies[i] ?? [] }));
}

/** Largest amount in [1, upper] for which `ok` holds, assuming it holds for small amounts only. */
function largest(upper: number, ok: (amount: number) => boolean): number {
  if (upper < 1 || !ok(1)) return 0;
  let low = 1;
  let high = upper + 1;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (ok(middle)) low = middle;
    else high = middle;
  }
  return low;
}

/** Above ratio 1 (attack below difficulty) no hunt can be won: the search never needs to look further. */
function upperAmount(input: PlanInput, count: number): number {
  const attack = armyAttack(input.army, input.levels);
  let upper = 1;
  const winnable = (amount: number) =>
    equalDrafts(input, count, amount).reduce((sum, draft) => sum + difficulty(draft.field, amount), 0) <= attack;
  while (winnable(upper * 2)) upper *= 2;
  return largest(upper * 2, winnable);
}

/** A hunt with everything the player is shown, simulated on the full number of draws. */
export function describeHunt(input: PlanInput, draft: Draft): PlannedHunt {
  const attack = armyAttack(draft.army, input.levels);
  const huntDifficulty = difficulty(draft.field, draft.amount);
  return {
    ...draft,
    outcome: evaluateHunt({ ...draft, levels: input.levels, samples: input.finalSamples ?? DEFAULT_FINAL_SAMPLES }),
    armyFood: armyFood(draft.army),
    attack,
    difficulty: huntDifficulty,
    calystene: calysteneEstimate(attack, huntDifficulty, input.levels.shield),
    durationSeconds: huntDurationSeconds(input.fieldAtLaunch, draft.amount, input.levels.huntSpeed),
  };
}

/** Null when a hunt breaks the objective on the full number of draws. */
function finalize(drafts: Draft[], input: PlanInput): Plan | null {
  const hunts: PlannedHunt[] = [];
  for (const draft of drafts) {
    const hunt = describeHunt(input, draft);
    if (!withinObjective(draft, input, hunt.outcome)) return null;
    hunts.push(hunt);
  }
  return summarize(hunts);
}

export function summarize(hunts: PlannedHunt[]): Plan {
  const totalAmount = hunts.reduce((sum, hunt) => sum + hunt.amount, 0);
  const durationSeconds = Math.max(0, ...hunts.map((hunt) => hunt.durationSeconds));
  return {
    hunts,
    totalAmount,
    durationSeconds,
    fieldPerHour: durationSeconds > 0 ? (totalAmount * 3600) / durationSeconds : 0,
  };
}

/** The search runs on fewer draws: shrink until the plan holds on the full number. */
function settle(input: PlanInput, build: (shrink: number) => Draft[]): Plan | null {
  for (let retry = 0; retry <= MAX_FINAL_RETRIES; retry++) {
    const drafts = build(retry);
    if (drafts.length === 0 || drafts.some((draft) => draft.amount < 1)) return null;
    const plan = finalize(drafts, input);
    if (plan) return plan;
  }
  return null;
}

const shrunk = (amount: number, retry: number) => amount - Math.max(retry, Math.ceil(amount * 0.02 * retry));

function planEqual(input: PlanInput, count: number): Plan | null {
  const samples = input.searchSamples ?? DEFAULT_SEARCH_SAMPLES;
  const amount = largest(upperAmount(input, count), (candidate) =>
    allMeet(equalDrafts(input, count, candidate), input, samples),
  );
  if (amount < 1) return null;
  return settle(input, (retry) => equalDrafts(input, count, shrunk(amount, retry)));
}

/** Same units per hunt; each hunt takes the most it can at the field the previous ones leave. */
function planUnequal(input: PlanInput, count: number): Plan | null {
  const samples = input.searchSamples ?? DEFAULT_SEARCH_SAMPLES;
  const armies = splitArmy(
    input.army,
    Array.from({ length: count }, () => 1),
  );
  const amounts: number[] = [];
  let field = input.field;
  for (const army of armies) {
    const solo = { ...input, army, field };
    const amount = largest(upperAmount(solo, 1), (candidate) =>
      allMeet([{ amount: candidate, field, army }], input, samples),
    );
    if (amount < 1) return null;
    amounts.push(amount);
    field += amount;
  }
  return settle(input, (retry) => {
    let at = input.field;
    return armies.map((army, i) => {
      const amount = shrunk(amounts[i] ?? 0, retry);
      const draft = { amount, field: at, army };
      at += amount;
      return draft;
    });
  });
}

export function planHunts(input: PlanInput): Plan {
  const counts = input.huntCount
    ? [input.huntCount]
    : Array.from({ length: Math.max(0, input.slots) }, (_, i) => i + 1);
  let best: Plan | null = null;
  for (const count of counts) {
    const plan = planEqual(input, count);
    if (plan && (!best || plan.fieldPerHour > best.fieldPerHour)) best = plan;
  }
  if (!best) return EMPTY_PLAN;
  if (best.hunts.length > 1 && input.objective.kind !== "ratio") {
    const unequal = planUnequal(input, best.hunts.length);
    if (unequal && unequal.fieldPerHour > best.fieldPerHour * UNEQUAL_GAIN) return unequal;
  }
  return best;
}

/** Equal hunts of a chosen surface, whatever the objective (the surface ↔ losses slider). */
export function planFixed(input: PlanInput, count: number, amount: number): Plan {
  if (amount < 1 || count < 1) return EMPTY_PLAN;
  return summarize(equalDrafts(input, count, amount).map((draft) => describeHunt(input, draft)));
}
