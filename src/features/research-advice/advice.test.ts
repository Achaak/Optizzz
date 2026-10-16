import { describe, expect, it } from "vitest";
import { armyFromKeys } from "@/game/army/units";
import { researchAdvice, verdictOf } from "./advice";

// The player of the example: 2 560 workers re-laid in 2 h 00 min 35 s, Bouclier 5 → 6.
const speed = 7235 / (2560 * 60);
const army = armyFromKeys({ JSN: 15_000, SN: 1282 });

describe("researchAdvice", () => {
  it("compares the research with the best unit laid while the workers it costs are laid again", () => {
    const advice = researchAdvice({ stat: "hp", level: 5, workers: 2560, army, speed, layable: ["JSN", "SN", "NE"] });
    expect(advice.layingMs).toBeCloseTo(7_235_000);
    expect(advice.armyBase).toBe(132_820);
    expect(advice.researchGain).toBeCloseTo(13_282);
    expect(advice.best).toMatchObject({ key: "JSN", count: 512, gain: 6144 });
    expect(advice.edge).toBeCloseTo(13_282 / 6144 - 1);
    // The research wins once the army's base HP is above ten times what the best unit brings.
    expect(advice.breakEven).toBeCloseTo(61_440);
  });

  it("ranks every unit the player can lay, best first, on the stat compared", () => {
    const advice = researchAdvice({
      stat: "attack",
      level: 0,
      workers: 2560,
      army,
      speed,
      layable: ["JSN", "A", "Tk"],
    });
    expect(advice.options.map((option) => option.key)).toEqual(["Tk", "A", "JSN"]);
    expect(advice.options[0]).toMatchObject({
      count: Math.floor(7235 / (1860 * speed)),
      gain: 55 * Math.floor(7235 / (1860 * speed)),
    });
  });

  it("uses the defense for Armes when the player defends", () => {
    const advice = researchAdvice({ stat: "defense", level: 0, workers: 2560, army, speed, layable: ["JSN", "C"] });
    expect(advice.researchGain).toBeCloseTo((15_000 * 2 + 1282 * 4) * 0.1);
    expect(advice.best?.key).toBe("C");
  });

  it("has no unit to compare with when none can be laid in that time", () => {
    const advice = researchAdvice({ stat: "hp", level: 5, workers: 1, army, speed, layable: ["JSN"] });
    expect(advice.best).toBeNull();
    expect(advice.edge).toBeNull();
  });
});

describe("verdictOf", () => {
  it("names the better choice, and calls it even within 5 %", () => {
    expect(verdictOf(1.16)).toBe("research");
    expect(verdictOf(-0.4)).toBe("laying");
    expect(verdictOf(0.03)).toBe("even");
    expect(verdictOf(null)).toBe("research");
  });
});
