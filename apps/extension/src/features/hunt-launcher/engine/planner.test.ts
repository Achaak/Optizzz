import { describe, expect, it } from "vitest";
import { difficulty } from "./difficulty";
import { planHunts, type PlanInput } from "./planner";
import { armyAttack, armyFromKeys, UNITS } from "@optizzz/game/army/units";

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

// Each plan simulates thousands of fights: slow when the whole suite runs at once.
describe("planHunts", { timeout: 20_000 }, () => {
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

  it("keeps the surface and the number of hunts the player chose", () => {
    const plan = planHunts({ ...base, huntCount: 3, huntAmount: 40 });
    expect(plan.hunts.map((hunt) => hunt.amount)).toEqual([40, 40, 40]);
  });

  it("with a chosen surface alone, keeps the number of hunts it would choose", () => {
    const small = { ...base, slots: 2 };
    const auto = planHunts(small);
    const plan = planHunts({ ...small, huntAmount: 25 });
    expect(plan.hunts.length).toBe(auto.hunts.length);
    expect(plan.hunts.every((hunt) => hunt.amount === 25)).toBe(true);
  });

  it("plans nothing when even 1 cm² cannot be won", () => {
    const plan = planHunts({ ...base, army: armyFromKeys({ JSN: 3 }) });
    expect(plan.hunts).toEqual([]);
    expect(plan.totalAmount).toBe(0);
  });
});

describe("planHunts by waves", { timeout: 20_000 }, () => {
  const mixed: PlanInput = {
    ...base,
    army: armyFromKeys({ JSN: 6000, SN: 400, JS: 500, A: 300, SE: 100 }),
    objective: { kind: "ratio", ratio: 8 },
  };

  it("keeps the surfaces of the mixed plan and sends the same army", () => {
    const plan = planHunts(mixed);
    const waves = planHunts({ ...mixed, dispatch: "waves" });
    expect(waves.waves).toBe("applied");
    expect(waves.hunts.map((hunt) => hunt.amount)).toEqual(plan.hunts.map((hunt) => hunt.amount));
    UNITS.forEach((_, i) => {
      const sent = (p: typeof plan) => p.hunts.reduce((sum, hunt) => sum + (hunt.army[i] ?? 0), 0);
      expect(sent(waves)).toBe(sent(plan));
    });
  });

  it("never keeps waves that lose more troops or promote fewer of them than the mix", () => {
    const troops = (plan: ReturnType<typeof planHunts>, of: "lost" | "promoted") =>
      plan.hunts.reduce(
        (sum, hunt) =>
          sum + Object.entries(hunt.outcome[of]).reduce((s, [key, count]) => s + (key === "JSN" ? 0 : count), 0),
        0,
      );
    const cases: PlanInput[] = [
      mixed,
      // s5, 18/10/2026: at ratio 1 a wave filled with young dwarves sends the soldiers back to the first hunt.
      {
        ...base,
        army: armyFromKeys({ JSN: 5550, SN: 485, NE: 29 }),
        field: 102_900,
        fieldAtLaunch: 102_900,
        levels: { weapons: 5, shield: 4, huntSpeed: 4, cochineal: 0 },
        objective: { kind: "ratio", ratio: 1 },
        huntCount: 2,
      },
      { ...mixed, army: armyFromKeys({ JSN: 3000, Tk: 400, TkE: 200 }), objective: { kind: "ratio", ratio: 5 } },
    ];
    for (const input of cases) {
      const plan = planHunts({ ...input, dispatch: "mix" });
      const waves = planHunts({ ...input, dispatch: "waves" });
      if (waves.waves !== "applied") continue;
      expect(troops(waves, "lost")).toBeLessThanOrEqual(troops(plan, "lost") + 0.1);
      expect(troops(waves, "promoted")).toBeGreaterThanOrEqual(troops(plan, "promoted"));
    }
  });

  it("changes nothing with one hunt", () => {
    const one = planHunts({ ...mixed, huntCount: 1, dispatch: "waves" });
    expect(one.waves).toBeUndefined();
  });
});
