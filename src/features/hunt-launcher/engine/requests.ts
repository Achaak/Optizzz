// Everything the view asks the engine, as plain data: it runs in a Web Worker.
import { compareWaiting, layingAdvice, lossCurve, type CurvePoint, type LayingStep, type Waiting } from "./extras";
import { describeHunt, planFixed, planHunts, type Draft, type Plan, type PlanInput, type PlannedHunt } from "./planner";

export type EngineRequest =
  | { type: "plan"; input: PlanInput }
  | { type: "extras"; input: PlanInput; plan: Plan; waiting: Waiting | null }
  | { type: "fixed"; input: PlanInput; count: number; amount: number }
  | { type: "hunt"; input: PlanInput; draft: Draft };

export interface Extras {
  curve: CurvePoint[];
  laying: LayingStep[];
  waiting: { plan: Plan; fieldPerHour: number } | null;
}

export type EngineAnswer<R extends EngineRequest> = R extends { type: "plan" }
  ? Plan
  : R extends { type: "extras" }
    ? Extras
    : R extends { type: "fixed" }
      ? Plan
      : PlannedHunt;

const CURVE_POINTS = 12;

function curveAround(input: PlanInput, plan: Plan): CurvePoint[] {
  const amount = plan.hunts[0]?.amount ?? 0;
  if (amount < 1) return [];
  const low = Math.max(1, Math.round(amount * 0.25));
  const high = Math.max(low + CURVE_POINTS, Math.round(amount * 2));
  const amounts = Array.from({ length: CURVE_POINTS }, (_, i) =>
    Math.round(low + ((high - low) * i) / (CURVE_POINTS - 1)),
  );
  return lossCurve(
    input,
    plan.hunts.length,
    [...new Set([...amounts, amount])].sort((a, b) => a - b),
  );
}

/** What-ifs around the plan shown, asked once the plan is on screen. */
function answerExtras(input: PlanInput, plan: Plan, waiting: Waiting | null): Extras {
  return {
    curve: curveAround(input, plan),
    laying: plan.hunts.length > 0 ? layingAdvice(input, plan) : [],
    waiting: waiting ? compareWaiting(input, waiting) : null,
  };
}

export function answer(request: EngineRequest): Extras | Plan | PlannedHunt {
  switch (request.type) {
    case "plan":
      return planHunts(request.input);
    case "extras":
      return answerExtras(request.input, request.plan, request.waiting);
    case "fixed":
      return planFixed(request.input, request.count, request.amount);
    case "hunt":
      return describeHunt(request.input, request.draft);
  }
}
