import { describe, expect, it } from "vitest";
import { difficulty } from "./difficulty";
import { planHunts, type PlanInput } from "./planner";
import { armyAttack, armyFromKeys, UNITS } from "@/game/army/units";

const levels = { weapons: 4, shield: 4, huntSpeed: 3, cochineal: 0 };
const base: PlanInput = {
  army: armyFromKeys({ JSN: 2112, SN: 146 }),
  field: 4496,
  fieldAtLaunch: 4496,
  slots: 4,
  levels,
  objective: { kind: "yield", maxLossShare: 0.01 },
  searchSamples: 300,
  finalSamples: 1000,
};

describe("planHunts", () => {
  it("never sends more than the army, nor more hunts than free slots", () => {
    const plan = planHunts(base);
    expect(plan.hunts.length).toBeGreaterThan(0);
    expect(plan.hunts.length).toBeLessThanOrEqual(4);
    UNITS.forEach((_, i) => {
      const sent = plan.hunts.reduce((sum, hunt) => sum + (hunt.army[i] ?? 0), 0);
      expect(sent).toBeLessThanOrEqual(base.army[i] ?? 0);
    });
  });

  it("fights each hunt at the hunting field left by the previous ones", () => {
    const plan = planHunts(base);
    let field = base.field;
    for (const hunt of plan.hunts) {
      expect(hunt.field).toBe(field);
      field += hunt.amount;
    }
  });

  it("keeps every hunt within the objective", () => {
    for (const hunt of planHunts(base).hunts) {
      expect(hunt.outcome.winChance).toBeGreaterThanOrEqual(0.99);
      expect(hunt.outcome.lossFood.p90).toBeLessThanOrEqual(0.01 * hunt.armyFood);
    }
  });

  it("hunts more when it accepts more losses", () => {
    const moreLosses = planHunts({ ...base, objective: { kind: "yield", maxLossShare: 0.03 } });
    expect(moreLosses.totalAmount).toBeGreaterThan(planHunts(base).totalAmount);
  });

  it("sizes a ratio hunt like Calystene: the largest surface keeping attack / difficulty at the ratio", () => {
    const plan = planHunts({ ...base, slots: 1, objective: { kind: "ratio", ratio: 8 } });
    const [hunt] = plan.hunts;
    if (!hunt) throw new Error("no hunt");
    const attack = armyAttack(base.army, levels);
    expect(attack / difficulty(base.field, hunt.amount)).toBeGreaterThanOrEqual(8);
    expect(attack / difficulty(base.field, hunt.amount + 1)).toBeLessThan(8);
  });

  it("keeps the plan that conquers the most per hour", () => {
    const best = planHunts(base);
    for (let count = 1; count <= base.slots; count++) {
      const forced = planHunts({ ...base, huntCount: count });
      expect(best.fieldPerHour).toBeGreaterThanOrEqual(forced.fieldPerHour - 1e-9);
    }
  });

  it("plans nothing when even 1 cm² cannot be won", () => {
    const plan = planHunts({ ...base, army: armyFromKeys({ JSN: 3 }) });
    expect(plan.hunts).toEqual([]);
    expect(plan.totalAmount).toBe(0);
  });
});
