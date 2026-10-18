import { describe, expect, it } from "vitest";
import { evaluateHunt } from "./evaluate";
import { equalDrafts, type PlanInput } from "./planner";
import { dispatchWaves } from "./waves";
import { armyFromKeys, UNITS } from "@/game/army/units";

const levels = { weapons: 4, shield: 4, huntSpeed: 3, cochineal: 0 };
const input: PlanInput = {
  army: armyFromKeys({ JSN: 20_000, SN: 1500, NE: 300, JS: 2000, S: 1500, A: 1000, SE: 400 }),
  field: 10_000,
  fieldAtLaunch: 10_000,
  slots: 4,
  levels,
  objective: { kind: "ratio", ratio: 8 },
  searchSamples: 300,
};
const index = (key: string) => UNITS.findIndex((unit) => unit.key === key);

describe("dispatchWaves", { timeout: 20_000 }, () => {
  const drafts = equalDrafts(input, 3, 300);
  const dispatched = dispatchWaves(input, drafts);
  const waves = Array.isArray(dispatched) ? dispatched : [];

  it("keeps the surfaces and sends every unit", () => {
    expect(waves.map((d) => [d.field, d.amount])).toEqual(drafts.map((d) => [d.field, d.amount]));
    UNITS.forEach((_, i) => {
      expect(waves.reduce((sum, d) => sum + (d.army[i] ?? 0), 0)).toBe(input.army[i]);
    });
  });

  it("puts the units that can still be promoted in the last hunts, the others and most young dwarves first", () => {
    const [first, , last] = waves;
    // Artilleuses fill a wave first (Calystene's order).
    expect(last?.army[index("A")]).toBeGreaterThan(0);
    expect(last?.army[index("NE")]).toBe(0);
    expect(last?.army[index("SE")]).toBe(0);
    expect(first?.army[index("JSN")]).toBeGreaterThan(last?.army[index("JSN")] ?? Infinity);
  });

  it("gives the hunts of promotable units just enough young dwarves for them to come back unhurt", () => {
    for (const draft of waves.slice(1)) {
      const outcome = evaluateHunt({ ...draft, levels, samples: 1000 });
      expect(outcome.winChance).toBe(1);
      const others = UNITS.reduce((sum, unit) => sum + (unit.key === "JSN" ? 0 : (outcome.lost[unit.key] ?? 0)), 0);
      expect(others).toBeLessThan(0.1);
    }
  });

  it("has nothing to do with young dwarves alone", () => {
    const alone = { ...input, army: armyFromKeys({ JSN: 20_000 }) };
    expect(dispatchWaves(alone, equalDrafts(alone, 3, 300))).toBe("same");
  });
});
