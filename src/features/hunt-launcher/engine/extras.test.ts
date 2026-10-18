import { describe, expect, it } from "vitest";
import { compareWaiting, layingAdvice, lossCurve, lossesByField, ratioChoices } from "./extras";
import { planHunts, type PlanInput } from "./planner";
import { armyFromKeys } from "@/game/army/units";

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

describe("ratioChoices", { timeout: 20_000 }, () => {
  it("hunts less and loses less as the ratio grows, as in Calystene's list", () => {
    const choices = ratioChoices({ ...input, slots: 1 });
    expect(choices.map((choice) => choice.ratio)).toEqual([1, 2, 3, 4, 5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10]);
    const low = choices.find((choice) => choice.ratio === 2);
    const high = choices.find((choice) => choice.ratio === 8);
    expect(high?.totalAmount).toBeLessThan(low?.totalAmount ?? 0);
    expect(high?.lostUnits).toBeLessThan(low?.lostUnits ?? 0);
    expect(high?.replyChance).toBeCloseTo(0.874);
    expect(high?.hunts).toBe(1);
  });

  it("keeps the number of hunts the player chose", () => {
    for (const choice of ratioChoices({ ...input, huntCount: 2 })) {
      if (choice.totalAmount > 0) expect(choice.hunts).toBe(2);
    }
  });
});

describe("lossesByField", { timeout: 20_000 }, () => {
  it("costs more as the field at arrival grows, same hunts and units", () => {
    const plan = planHunts({ ...input, slots: 2 });
    const rows = lossesByField(input, plan, [0.5, 1, 2]);
    expect(rows.map((row) => row.field)).toEqual([2248, 4496, 8992]);
    const [small, same, big] = rows;
    expect(same?.difficulty).toBeCloseTo(plan.hunts.reduce((sum, hunt) => sum + hunt.difficulty, 0));
    expect(big?.difficulty).toBeGreaterThan(same?.difficulty ?? Infinity);
    expect(small?.ratio).toBeGreaterThan(same?.ratio ?? Infinity);
    expect(big?.lostUnits.mean).toBeGreaterThan(small?.lostUnits.mean ?? Infinity);
  });
});
