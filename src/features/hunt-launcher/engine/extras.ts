// What-ifs shown next to the plan: surface ↔ losses, laying more, waiting for the hunts away.
import { equalDrafts, describeHunt, planHunts, type Plan, type PlanInput } from "./planner";
import { UNITS, type Army } from "@/game/army/units";

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
