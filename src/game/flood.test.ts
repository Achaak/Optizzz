import { describe, expect, it } from "vitest";
import { armyFromKeys, armyToKeys, emptyArmy } from "./army/units";
import { firstWave, planAttacks, planFlood } from "./flood";

const takes = (input: Parameters<typeof planFlood>[0]) => planFlood(input).map((wave) => wave.take);

describe("planFlood", () => {
  it("takes 20 % of what is left at each attack while the target stays in range", () => {
    // 2000 → 400 (me 1400, it 1600), 320 (1720, 1280), then the last slot takes 256.
    expect(planFlood({ attackerField: 1000, targetField: 2000, slots: 3, ants: 10_000, margin: 0 })).toEqual([
      { ants: 400, take: 400, attackerAfter: 1400, targetAfter: 1600 },
      { ants: 320, take: 320, attackerAfter: 1720, targetAfter: 1280 },
      { ants: 256, take: 256, attackerAfter: 1976, targetAfter: 1024 },
    ]);
  });

  it("leaves the target just at 50 % before the last attack, rather than out of range", () => {
    // 200 (1200, 800); 20 % would leave it at 640 < 1360 / 2: take (1600 − 1200) / 3 = 133 instead (1333, 667);
    // the last attack takes 20 % of 667.
    expect(takes({ attackerField: 1000, targetField: 1000, slots: 3, ants: 10_000, margin: 0 })).toEqual([
      200, 133, 133,
    ]);
  });

  it("keeps a margin above the 50 %", () => {
    // Limit: (1600 − 1.01 × 1200) / 3.01 = 128.9 → 128 (1328, 672: 1344 ≥ 1341.3); then 20 % of 672.
    expect(takes({ attackerField: 1000, targetField: 1000, slots: 3, ants: 10_000, margin: 0.01 })).toEqual([
      200, 128, 134,
    ]);
  });

  it("takes no more than one cm² per ant", () => {
    expect(takes({ attackerField: 1000, targetField: 2000, slots: 3, ants: 500, margin: 0 })).toEqual([400, 100]);
  });

  it("stops after a full take when nothing could follow it", () => {
    // 100 leaves it at 400 for my 1100: out of range, and no smaller take helps the next one.
    expect(takes({ attackerField: 1000, targetField: 500, slots: 2, ants: 10_000, margin: 0 })).toEqual([100]);
  });

  it("plans nothing out of range, without slots or without ants", () => {
    expect(takes({ attackerField: 1000, targetField: 499, slots: 3, ants: 10_000, margin: 0 })).toEqual([]);
    expect(takes({ attackerField: 1000, targetField: 3000, slots: 3, ants: 10_000, margin: 0 })).toEqual([]);
    expect(takes({ attackerField: 1000, targetField: 2000, slots: 0, ants: 10_000, margin: 0 })).toEqual([]);
    expect(takes({ attackerField: 1000, targetField: 2000, slots: 3, ants: 0, margin: 0 })).toEqual([]);
  });
});

describe("firstWave", () => {
  const levels = { weapons: 0, shield: 0 };
  const defender = (field: Record<string, number>) => ({
    armies: { field: armyFromKeys(field), nest: emptyArmy(), lodge: emptyArmy() },
    weapons: 0,
    shield: 0,
    dome: 0,
    lodge: 0,
  });

  it("sends the smallest army that crushes the defense on the field (reply 10 %)", () => {
    // 100 JSN defend with 800 hp: more than 3 × 800 = 2 400 damage takes 801 JSN (attack 3).
    const wave = firstWave(armyFromKeys({ JSN: 10_000 }), defender({ JSN: 100 }), levels);
    expect(wave?.army).toEqual(armyFromKeys({ JSN: 801 }));
    expect(wave?.survivors).toBeLessThanOrEqual(801);
    expect(wave?.survivors).toBeGreaterThan(780);
  });

  it("takes the strongest units first", () => {
    // 5 Soldates (attack 15) + 776 JSN: 75 + 2 328 = 2 403 > 2 400.
    const wave = firstWave(armyFromKeys({ JSN: 10_000, S: 5 }), defender({ JSN: 100 }), levels);
    expect(wave?.army).toEqual(armyFromKeys({ JSN: 776, S: 5 }));
  });

  it("says when my army is not enough", () => {
    expect(firstWave(armyFromKeys({ JSN: 500 }), defender({ JSN: 100 }), levels)).toBeNull();
  });
});

describe("planAttacks", () => {
  const base = { attackerField: 1000, targetField: 2000, slots: 3, margin: 0, levels: { weapons: 0, shield: 0 } };

  it("sends the cheapest units first when nobody defends", () => {
    const plan = planAttacks({ ...base, available: armyFromKeys({ JSN: 300, S: 1000 }), defender: null });
    expect(plan.blocked).toBe(false);
    expect(plan.attacks.map((attack) => [attack.take, armyToKeys(attack.army)])).toEqual([
      [400, armyToKeys(armyFromKeys({ JSN: 300, S: 100 }))],
      [320, armyToKeys(armyFromKeys({ S: 320 }))],
      [256, armyToKeys(armyFromKeys({ S: 256 }))],
    ]);
  });

  it("opens with a wave that crushes the defense, then floods with what is left", () => {
    const defender = {
      armies: { field: armyFromKeys({ JSN: 100 }), nest: emptyArmy(), lodge: emptyArmy() },
      weapons: 0,
      shield: 0,
      dome: 0,
      lodge: 0,
    };
    const plan = planAttacks({ ...base, available: armyFromKeys({ JSN: 2000 }), defender });
    const [opening, ...rest] = plan.attacks;
    // 801 JSN crush 100 JSN and lose a few: the survivors (fewer than 400) cap the first take.
    expect(opening?.army).toEqual(armyFromKeys({ JSN: 801 }));
    expect(opening?.take).toBe(400);
    expect(rest.map((attack) => attack.ants)).toEqual([320, 256]);
  });

  it("says when the army cannot beat the defense", () => {
    const defender = {
      armies: { field: armyFromKeys({ JSN: 100 }), nest: emptyArmy(), lodge: emptyArmy() },
      weapons: 0,
      shield: 0,
      dome: 0,
      lodge: 0,
    };
    const plan = planAttacks({ ...base, available: armyFromKeys({ JSN: 500 }), defender });
    expect(plan).toEqual({ attacks: [], blocked: true });
  });
});
