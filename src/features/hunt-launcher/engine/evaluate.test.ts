import { describe, expect, it } from "vitest";
import { calysteneEstimate } from "./calystene";
import { difficulty } from "./difficulty";
import { evaluateHunt } from "./evaluate";
import { armyFromKeys } from "./units";

const levels = { weapons: 4, shield: 4, huntSpeed: 3, cochineal: 0 };
// The army of the 07/10 11h08 report.
const army = armyFromKeys({ JSN: 1921, SN: 119 });

describe("evaluateHunt", () => {
  it("expects a few young dwarves lost on the reported hunt, as the reports show", () => {
    const outcome = evaluateHunt({ army, field: 3886, amount: 118, levels, samples: 2000 });
    expect(outcome.winChance).toBe(1);
    expect(outcome.zeroLossChance).toBe(0);
    // Reports of that day: 4 to 6 reported dead; lost (half-hp rule) is one more at most.
    expect(outcome.reportedDead.JSN).toBeGreaterThan(3);
    expect(outcome.reportedDead.JSN).toBeLessThan(7);
    expect(outcome.lost.JSN).toBeGreaterThanOrEqual(outcome.reportedDead.JSN ?? 0);
    expect(outcome.promoted.JSN).toBeGreaterThan(3);
    expect(outcome.promoted.JSN).toBeLessThan(8);
    expect(outcome.lostUnits.mean).toBeCloseTo(outcome.lost.JSN ?? 0);
    expect(outcome.lostUnits.p90).toBeGreaterThanOrEqual(Math.floor(outcome.lostUnits.mean));
    expect(outcome.lostUnits.max).toBeGreaterThanOrEqual(outcome.lostUnits.p90);
  });

  it("finds no loss on a tiny hunt guarded by tanks", () => {
    const tanks = armyFromKeys({ Tk: 200 });
    const outcome = evaluateHunt({ army: tanks, field: 3886, amount: 5, levels, samples: 500 });
    expect(outcome.zeroLossChance).toBe(1);
    expect(outcome.lossFood.p90).toBe(0);
  });

  it("loses everything when the army is far too weak", () => {
    const outcome = evaluateHunt({ army: armyFromKeys({ JSN: 10 }), field: 3886, amount: 500, levels, samples: 200 });
    expect(outcome.winChance).toBe(0);
    expect(outcome.lossFood.max).toBe(10 * 16);
  });

  it("is the same every time for the same hunt", () => {
    const first = evaluateHunt({ army, field: 3886, amount: 118, levels, samples: 300 });
    expect(evaluateHunt({ army, field: 3886, amount: 118, levels, samples: 300 })).toEqual(first);
  });
});

describe("calysteneEstimate", () => {
  it("uses the reference ratio just below the real one", () => {
    // 8 902 attack against a 991 difficulty: ratio 8.98, reference 8.5.
    const estimate = calysteneEstimate(8902, difficulty(3886, 118), 4);
    expect(estimate.ratio).toBeCloseTo(8.98, 2);
    expect(estimate.referenceRatio).toBe(8.5);
    // 0.009339662 × 991.4 × 10 / 14
    expect(estimate.average).toBeCloseTo(6.61, 1);
  });

  it("has no estimate under ratio 1", () => {
    expect(calysteneEstimate(50, 100, 0).referenceRatio).toBeNull();
  });
});
