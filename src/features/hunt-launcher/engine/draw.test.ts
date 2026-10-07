import { describe, expect, it } from "vitest";
import { foodTarget } from "./difficulty";
import { drawPack, seededRandom } from "./draw";
import { PREYS, type Pack } from "./prey";

const packFood = (pack: Pack) => pack.reduce((sum, count, i) => sum + count * (PREYS[i]?.food ?? 0), 0);

describe("drawPack", () => {
  // 07/10 11h08: 118 cm² at 3 886 cm², about 793 food.
  const target = foodTarget(3886, 118);
  const random = seededRandom(1);
  const packs = Array.from({ length: 2000 }, () => drawPack(3886, 118, random));

  it("covers the food target, overshooting by at most one 5 % block of small spiders", () => {
    const smallSpider = PREYS[0]?.food ?? 0;
    for (const pack of packs) {
      expect(packFood(pack)).toBeGreaterThanOrEqual(target - 1e-6);
      expect(packFood(pack)).toBeLessThan(target + Math.ceil((0.05 * target) / smallSpider) * smallSpider);
    }
  });

  it("never draws a prey worth more than 75 % of the target", () => {
    const mantis = PREYS.findIndex((prey) => prey.name === "Mante religieuse");
    for (const pack of packs) expect(pack.slice(mantis).every((count) => count === 0)).toBe(true);
  });

  it("draws packs like the real reports: a handful of prey types", () => {
    const types = packs.map((pack) => pack.filter((count) => count > 0).length);
    expect(Math.max(...types)).toBeLessThanOrEqual(6);
  });

  it("is reproducible from a seed", () => {
    const again = seededRandom(1);
    expect(drawPack(3886, 118, again)).toEqual(packs[0]);
  });
});
