// What-ifs shown next to the plan: surface ↔ losses, laying more, waiting for the hunts away, each ratio, the field at
// arrival.
import { REFERENCE_RATIOS } from "./calystene";
import type { Spread } from "./evaluate";
import { equalDrafts, describeHunt, planHunts, type Plan, type PlanInput } from "./planner";
import { UNITS, type Army } from "@optizzz/game/army/units";

export interface CurvePoint {
  amount: number;
  /** Worst hunt of the plan. */
  zeroLossChance: number;
  /** Mean units lost, all hunts together. */
  lostUnits: number;
  fieldPerHour: number;
}

/** Equal hunts at each surface, simulated on the search draws (cheap enough to draw a curve). */
export function lossCurve(input: PlanInput, count: number, amounts: readonly number[]): CurvePoint[] {
  const quick = { ...input, finalSamples: input.searchSamples ?? 1000 };
  return amounts.map((amount) => {
    const hunts = equalDrafts(quick, count, amount).map((draft) => describeHunt(quick, draft));
    const duration = Math.max(...hunts.map((hunt) => hunt.durationSeconds));
    return {
      amount,
      zeroLossChance: Math.min(...hunts.map((hunt) => hunt.outcome.zeroLossChance)),
      lostUnits: hunts.reduce((sum, hunt) => sum + hunt.outcome.lostUnits.mean, 0),
      fieldPerHour: (count * amount * 3600) / duration,
    };
  });
}

export interface LayingStep {
  unit: string;
  extra: number;
  plan: Plan;
}

const LAYING_STEPS = [0.1, 0.25];

/** The plan with 10 % and 25 % more of the most numerous unit. */
export function layingAdvice(input: PlanInput, current: Plan): LayingStep[] {
  const most = input.army.reduce((best, count, i) => (count > (input.army[best] ?? 0) ? i : best), 0);
  const unit = UNITS[most];
  const count = input.army[most] ?? 0;
  if (!unit || count === 0) return [];
  return LAYING_STEPS.map((step) => {
    const extra = Math.round(count * step);
    const army = input.army.map((value, i) => (i === most ? value + extra : value));
    const plan = planHunts({ ...input, army, huntCount: current.hunts.length || undefined });
    return { unit: unit.key, extra, plan };
  });
}

export interface Waiting {
  /** Units away hunting, back when the hunts return. */
  troops: Army;
  waitSeconds: number;
  /** Hunt slots once every hunt is back. */
  allSlots: number;
}

/** The plan if the player waits for the hunts away, and what it conquers per hour wait included. */
export function compareWaiting(input: PlanInput, waiting: Waiting): { plan: Plan; fieldPerHour: number } {
  const army = input.army.map((count, i) => count + (waiting.troops[i] ?? 0));
  const plan = planHunts({ ...input, army, slots: waiting.allSlots });
  const total = waiting.waitSeconds + plan.durationSeconds;
  return { plan, fieldPerHour: total > 0 ? (plan.totalAmount * 3600) / total : 0 };
}

export interface RatioChoice {
  ratio: number;
  hunts: number;
  totalAmount: number;
  /** Mean units lost, all hunts together. */
  lostUnits: number;
  /** Calystene's chance of a « 10 % reply ». */
  replyChance: number;
}

/** What each ratio of Calystene's list would hunt, for the list to show it before one is picked. */
export function ratioChoices(input: PlanInput): RatioChoice[] {
  // The list only needs what each ratio hunts: no surface forced, no waves to search.
  const auto = { ...input, huntAmount: undefined, dispatch: undefined };
  const quick = { ...auto, finalSamples: input.searchSamples ?? 1000 };
  return REFERENCE_RATIOS.map((ratio) => {
    const plan = planHunts({ ...quick, objective: { kind: "ratio", ratio } });
    return {
      ratio,
      hunts: plan.hunts.length,
      totalAmount: plan.totalAmount,
      lostUnits: plan.hunts.reduce((sum, hunt) => sum + hunt.outcome.lostUnits.mean, 0),
      replyChance: Math.min(1, ...plan.hunts.map((hunt) => hunt.calystene.replyChance)),
    };
  });
}

export interface FieldRow {
  /** Hunting field when the first hunt arrives. */
  field: number;
  difficulty: number;
  /** Attack / difficulty, all hunts together. */
  ratio: number;
  /** Units lost, all hunts added up. */
  lostUnits: Spread;
  winChance: number;
}

const add = (a: Spread, b: Spread): Spread => ({
  min: a.min + b.min,
  mean: a.mean + b.mean,
  p90: a.p90 + b.p90,
  max: a.max + b.max,
});

/** The same hunts (surfaces and units) if the field at arrival were `factors` times the one planned for. */
export function lossesByField(input: PlanInput, plan: Plan, factors: readonly number[]): FieldRow[] {
  const quick = { ...input, finalSamples: input.searchSamples ?? 1000 };
  return factors.map((factor) => {
    const field = Math.max(1, Math.round(input.field * factor));
    let at = field;
    const hunts = plan.hunts.map((hunt) => {
      const draft = { amount: hunt.amount, field: at, army: hunt.army };
      at += hunt.amount;
      return describeHunt(quick, draft);
    });
    const difficulty = hunts.reduce((sum, hunt) => sum + hunt.difficulty, 0);
    const attack = hunts.reduce((sum, hunt) => sum + hunt.attack, 0);
    return {
      field,
      difficulty,
      ratio: difficulty > 0 ? attack / difficulty : 0,
      lostUnits: hunts.reduce((sum, hunt) => add(sum, hunt.outcome.lostUnits), { min: 0, mean: 0, p90: 0, max: 0 }),
      winChance: Math.min(1, ...hunts.map((hunt) => hunt.outcome.winChance)),
    };
  });
}
