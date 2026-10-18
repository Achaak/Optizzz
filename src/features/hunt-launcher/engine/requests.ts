// Everything the view asks the engine, as plain data: it runs in a Web Worker.
import {
  compareWaiting,
  layingAdvice,
  lossCurve,
  lossesByField,
  ratioChoices,
  type CurvePoint,
  type FieldRow,
  type LayingStep,
  type RatioChoice,
  type Waiting,
} from "./extras";
import { describeHunt, planHunts, type Draft, type Plan, type PlanInput, type PlannedHunt } from "./planner";

export type EngineRequest =
  | { type: "plan"; input: PlanInput }
  | { type: "extras"; input: PlanInput; plan: Plan; waiting: Waiting | null }
  | { type: "ratios"; input: PlanInput }
  | { type: "hunt"; input: PlanInput; draft: Draft };

export interface Extras {
  curve: CurvePoint[];
  laying: LayingStep[];
  waiting: { plan: Plan; fieldPerHour: number } | null;
  byField: FieldRow[];
}

export type EngineAnswer<R extends EngineRequest> = R extends { type: "plan" }
  ? Plan
  : R extends { type: "extras" }
    ? Extras
    : R extends { type: "ratios" }
      ? RatioChoice[]
      : PlannedHunt;

const CURVE_POINTS = 12;
/** Fields at arrival the plan is tried at, as a share of the one planned for. */
const FIELD_FACTORS = [0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 2];

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

/** What-ifs around the plan shown, asked once the plan is on screen; laying and waiting choose the surface, mixed. */
function answerExtras(input: PlanInput, plan: Plan, waiting: Waiting | null): Extras {
  const auto = { ...input, huntAmount: undefined, dispatch: undefined };
  return {
    curve: curveAround(input, plan),
    laying: plan.hunts.length > 0 ? layingAdvice(auto, plan) : [],
    waiting: waiting ? compareWaiting(auto, waiting) : null,
    byField: plan.hunts.length > 0 ? lossesByField(input, plan, FIELD_FACTORS) : [],
  };
}

export function answer(request: EngineRequest): Extras | Plan | PlannedHunt | RatioChoice[] {
  switch (request.type) {
    case "plan":
      return planHunts(request.input);
    case "extras":
      return answerExtras(request.input, request.plan, request.waiting);
    case "ratios":
      return ratioChoices(request.input);
    case "hunt":
      return describeHunt(request.input, request.draft);
  }
}
