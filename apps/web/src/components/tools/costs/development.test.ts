import { levelCost } from "@optizzz/game/level-costs";
import { describe, expect, it } from "vitest";
import { bonusKeyOf, costedResources, developmentPlan, levelSeconds } from "./development";

// Times read in the game on 2026-10-23, bonus included (docs/research/couts-des-niveaux.md): s5 has Architecture 10
// and Salle d'analyse 7, s2 Architecture 20 and Salle d'analyse 19.

describe("bonusKeyOf", () => {
  it("is Architecture for a building, Salle d'analyse for a research", () => {
    expect(bonusKeyOf("mushroom")).toBe("architecture");
    expect(bonusKeyOf("analysisRoom")).toBe("architecture");
    expect(bonusKeyOf("laying")).toBe("analysisRoom");
    expect(bonusKeyOf("architecture")).toBe("analysisRoom");
  });
});

describe("levelSeconds", () => {
  it("takes 10 % off per bonus level, then rounds to the second, as the game shows it", () => {
    expect(levelSeconds("mushroom", 17, 10)).toBe(77_184); // s5, Architecture 10: 21H 26m 24s
    expect(levelSeconds("laying", 12, 7)).toBe(19_671); // s5, Salle d'analyse 7: 5H 27m 51s
    expect(levelSeconds("genetics", 1, 7)).toBe(86); // s5: 1m 26s
    expect(levelSeconds("poison", 1, 7)).toBe(23_915); // s5: 6H 38m 35s
    expect(levelSeconds("laboratory", 21, 20)).toBe(440_931); // s2, Architecture 20: 5J 2H 28m 51s
    expect(levelSeconds("solarium", 20, 20)).toBe(606_424); // s2: 7J 27m 4s
    expect(levelSeconds("architecture", 21, 19)).toBe(642_103); // s2, Salle d'analyse 19: 7J 10H 21m 43s
  });

  it("is the table's time, rounded, without a bonus", () => {
    expect(levelSeconds("dome", 1, 0)).toBe(400);
    expect(levelSeconds("architecture", 8, 0)).toBe(Math.round(levelCost("architecture", 8).seconds));
  });
});

describe("developmentPlan", () => {
  it("lists each level after the one held, with its cost, its time and the running totals", () => {
    const plan = developmentPlan("mushroom", 0, 3, 0);
    expect(plan.rows).toEqual([
      {
        level: 1,
        cost: { food: 0, materials: 90, workers: 0 },
        seconds: 120,
        totalCost: { food: 0, materials: 90, workers: 0 },
        totalSeconds: 120,
      },
      {
        level: 2,
        cost: { food: 0, materials: 166, workers: 0 },
        seconds: 192,
        totalCost: { food: 0, materials: 256, workers: 0 },
        totalSeconds: 312,
      },
      {
        level: 3,
        cost: { food: 0, materials: 308, workers: 0 },
        seconds: 307,
        totalCost: { food: 0, materials: 564, workers: 0 },
        totalSeconds: 619,
      },
    ]);
    expect(plan.total).toEqual({ cost: { food: 0, materials: 564, workers: 0 }, seconds: 619 });
  });

  it("adds up the levels rounded one by one, not the rounded sum", () => {
    // Génétique 1 and 2 at Salle d'analyse 6: 95.66 + 162.62 s, 258.28 s unrounded.
    const plan = developmentPlan("genetics", 0, 2, 6);
    expect(plan.rows.map(({ seconds }) => seconds)).toEqual([96, 163]);
    expect(plan.total.seconds).toBe(259);
    const unrounded = [1, 2].reduce((sum, level) => sum + levelCost("genetics", level).seconds * 0.9 ** 6, 0);
    expect(Math.round(unrounded)).toBe(258);
  });

  it("adds up the costs the table gives (Communication 5 to 8, s5)", () => {
    expect(developmentPlan("animals", 5, 8, 0).total.cost).toEqual({
      food: 6_400 + 12_800 + 25_600,
      materials: 16_000 + 32_000 + 64_000,
      workers: 2_560 + 5_120 + 10_240,
    });
  });

  it("has nothing when the level aimed at is not above the one held", () => {
    expect(developmentPlan("dome", 5, 5, 3)).toEqual({
      rows: [],
      total: { cost: { food: 0, materials: 0, workers: 0 }, seconds: 0 },
    });
    expect(developmentPlan("dome", 6, 5, 3).rows).toEqual([]);
  });
});

describe("costedResources", () => {
  it("is what the element costs: materials only for a building", () => {
    expect(costedResources("dome")).toEqual(["materials"]);
    expect(costedResources("laying")).toEqual(["food", "materials"]);
    expect(costedResources("shield")).toEqual(["food", "materials", "workers"]);
  });
});
