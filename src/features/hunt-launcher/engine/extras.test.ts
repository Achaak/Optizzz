import { describe, expect, it } from "vitest";
import { compareWaiting, layingAdvice, lossCurve } from "./extras";
import { planHunts, type PlanInput } from "./planner";
import { armyFromKeys } from "./units";

const input: PlanInput = {
  army: armyFromKeys({ JSN: 2112, SN: 146 }),
  field: 4496,
  fieldAtLaunch: 4496,
  slots: 4,
  levels: { weapons: 4, shield: 4, huntSpeed: 3, cochineal: 0 },
  objective: { kind: "yield", maxLossShare: 0.01 },
  searchSamples: 300,
  finalSamples: 500,
};

describe("lossCurve", () => {
  it("loses more as the surface grows", () => {
    const curve = lossCurve(input, 1, [50, 150, 300]);
    expect(curve.map((point) => point.amount)).toEqual([50, 150, 300]);
    const [small, , big] = curve;
    expect(big?.lostUnits).toBeGreaterThan(small?.lostUnits ?? Infinity);
    expect(big?.fieldPerHour).toBeGreaterThan(small?.fieldPerHour ?? Infinity);
  });
});

describe("layingAdvice", () => {
  it("tells what more of the most numerous unit would bring", () => {
    const base = planHunts(input);
    const advice = layingAdvice(input, base);
    expect(advice.map((step) => [step.unit, step.extra])).toEqual([
      ["JSN", 211],
      ["JSN", 528],
    ]);
    for (const step of advice) expect(step.plan.totalAmount).toBeGreaterThanOrEqual(base.totalAmount);
  });
});

describe("compareWaiting", () => {
  it("plans with the returning troops and every slot, counting the wait", () => {
    const now = planHunts({ ...input, army: armyFromKeys({ JSN: 200 }), slots: 1 });
    const waiting = compareWaiting(
      { ...input, army: armyFromKeys({ JSN: 200 }), slots: 1 },
      { troops: armyFromKeys({ JSN: 1912, SN: 146 }), waitSeconds: 600, allSlots: 4 },
    );
    expect(waiting.plan.totalAmount).toBeGreaterThan(now.totalAmount);
    expect(waiting.fieldPerHour).toBeCloseTo((waiting.plan.totalAmount * 3600) / (600 + waiting.plan.durationSeconds));
  });
});
