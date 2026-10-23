import { describe, expect, it } from "vitest";
import { LEVEL_BASES, levelCost, levelsCost } from "./level-costs";
import { BUILDINGS, RESEARCH } from "./levels";
import { SPEED_UP_FACTOR } from "./speed-up";

// Checkpoints read on 2026-10-23 from toolzzz.fr/couts.php (no Architecture) and on s5 and s2 (construction.php,
// laboratoire.php). See docs/research/couts-des-niveaux.md.

/** The game's time once Architecture or Salle d'analyse is at `levels`, rounded to the second as it shows it. */
const shown = (seconds: number, levels: number) => Math.round(seconds * SPEED_UP_FACTOR ** levels);

/** Toolzzz rounds each level to the second, and its float chain may end a second away from ours. */
const expectSeconds = (seconds: number, toolzzz: number, levels = 1) =>
  expect(Math.abs(seconds - toolzzz)).toBeLessThanOrEqual(levels);

describe("LEVEL_BASES", () => {
  it("has the first level of every building and research", () => {
    expect(Object.keys(LEVEL_BASES).sort()).toEqual([...BUILDINGS, ...RESEARCH].map(({ key }) => key).sort());
  });

  it("makes buildings cost materials only", () => {
    for (const { key } of BUILDINGS) {
      expect(LEVEL_BASES[key].cost.food).toBe(0);
      expect(LEVEL_BASES[key].cost.workers).toBe(0);
    }
  });
});

describe("levelCost", () => {
  it("gives the first level as relevé", () => {
    expect(levelCost("cochineal", 1)).toEqual({ cost: { food: 0, materials: 10_000, workers: 0 }, seconds: 150 });
    expect(levelCost("poison", 1)).toEqual({
      cost: { food: 40_000_000, materials: 15_000_000, workers: 250_000 },
      seconds: 50_000,
    });
  });

  it("doubles the cost and multiplies the time by 1.7 for a research (Toolzzz, Architecture 8)", () => {
    const { cost, seconds } = levelCost("architecture", 8);
    expect(cost).toEqual({ food: 12_800, materials: 25_600, workers: 0 });
    expectSeconds(seconds, 8_207);
  });

  it("multiplies the time by 1.6 for a building (Toolzzz, Entrepôt de Nourriture 6)", () => {
    const { cost, seconds } = levelCost("foodWarehouse", 6);
    expect(cost.materials).toBe(19_200);
    expectSeconds(seconds, 1_887);
  });

  it("floors the Champignonnière's cost, × 1.85 a level (s5, s2, and the construction-costs fixture)", () => {
    expect(levelCost("mushroom", 2).cost.materials).toBe(166);
    expect(levelCost("mushroom", 9).cost.materials).toBe(12_348);
    expect(levelCost("mushroom", 17).cost.materials).toBe(1_694_299);
    expect(levelCost("mushroom", 18).cost.materials).toBe(3_134_453);
  });

  it("matches the game's times once its bonus is applied (s5 and s2)", () => {
    expect(shown(levelCost("mushroom", 17).seconds, 10)).toBe(77_184); // s5, Architecture 10: 21H 26m 24s
    expect(shown(levelCost("laying", 12).seconds, 7)).toBe(19_671); // s5, Salle d'analyse 7: 5H 27m 51s
    expect(shown(levelCost("laboratory", 21).seconds, 20)).toBe(440_931); // s2, Architecture 20: 5J 2H 28m 51s
  });

  it("slows down to × 1.3 once a level lasts over 30 days, as s2 shows", () => {
    // Solarium 19 is the first × 1.3; Architecture 20 and Technique de ponte 21 too.
    expect(shown(levelCost("solarium", 20).seconds, 20)).toBe(606_424); // 7J 27m 4s
    expect(shown(levelCost("architecture", 21).seconds, 19)).toBe(642_103); // 7J 10H 21m 43s
    expect(shown(levelCost("laying", 21).seconds, 19)).toBe(503_804); // 5J 19H 56m 44s
  });

  it("then to × 1.2 and × 1.12 at the levels Toolzzz gives", () => {
    expectSeconds(levelCost("laboratory", 22).seconds, 4_714_811);
    expectSeconds(levelCost("laboratory", 30).seconds, 35_501_685);
    expectSeconds(levelCost("laboratory", 36).seconds, 98_940_301);
    expectSeconds(levelCost("mushroom", 38).seconds, 101_314_868);
    expectSeconds(levelCost("acid", 13).seconds, 4_455_347);
    expectSeconds(levelCost("acid", 29).seconds, 273_661_069);
  });

  it("keeps × 1.7 for the Poison, which Toolzzz never slows down", () => {
    expect(levelCost("poison", 20).seconds).toBeCloseTo(50_000 * 1.7 ** 19);
  });

  it("refuses a level under 1 or not whole", () => {
    expect(() => levelCost("dome", 0)).toThrow(RangeError);
    expect(() => levelCost("dome", 1.5)).toThrow(RangeError);
  });
});

describe("levelsCost", () => {
  it("adds up the levels after `from` up to `to` (Toolzzz's « Coût total » and « Durée totale »)", () => {
    const { cost, seconds } = levelsCost("architecture", 0, 8);
    expect(cost).toEqual({ food: 25_500, materials: 51_000, workers: 0 });
    expectSeconds(seconds, 19_647, 8); // 5H 27m 27s
  });

  it("starts from the level held (Communication 8: 10 240 / 25 600 / 64 000, s5)", () => {
    const { cost } = levelsCost("animals", 5, 8);
    expect(cost).toEqual({
      food: 6_400 + 12_800 + 25_600,
      materials: 16_000 + 32_000 + 64_000,
      workers: 2_560 + 5_120 + 10_240,
    });
  });

  it("adds up the Champignonnière's floored levels, as the game charges them", () => {
    expect(levelsCost("mushroom", 0, 3).cost.materials).toBe(90 + 166 + 308);
    expect(levelsCost("mushroom", 16, 18).cost.materials).toBe(1_694_299 + 3_134_453);
  });

  it("costs nothing when there is no level to gain", () => {
    expect(levelsCost("dome", 5, 5)).toEqual({ cost: { food: 0, materials: 0, workers: 0 }, seconds: 0 });
    expect(levelsCost("dome", 6, 5)).toEqual({ cost: { food: 0, materials: 0, workers: 0 }, seconds: 0 });
  });

  it("refuses a negative level", () => {
    expect(() => levelsCost("dome", -1, 2)).toThrow(RangeError);
  });
});
