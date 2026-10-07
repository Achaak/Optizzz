import { describe, expect, it } from "vitest";
import { battle, placeHpBonus, requiredAttack, spoils, type Defender } from "./battle";
import { armyFromKeys, UNITS } from "./units";

const at = (key: string) => UNITS.findIndex((unit) => unit.key === key);
const none = armyFromKeys({});
const defender = (overrides: Partial<Defender> = {}): Defender => ({
  armies: { field: none, nest: none, lodge: none },
  weapons: 0,
  shield: 0,
  dome: 0,
  lodge: 0,
  ...overrides,
});

describe("placeHpBonus", () => {
  it("gives no bonus on the hunting field, 10 % + 5 %/level in the nest, 30 % + 15 %/level in the lodge", () => {
    const levels = defender({ dome: 4, lodge: 2 });
    expect(placeHpBonus("field", levels)).toBe(0);
    expect(placeHpBonus("nest", levels)).toBeCloseTo(0.3);
    expect(placeHpBonus("lodge", levels)).toBeCloseTo(0.6);
  });
});

describe("battle", () => {
  it("crushes a small garrison: its reply falls to 10 %", () => {
    // 1 000 JSN deal 3 000; 100 JSN have 800 hp: ratio 3.75.
    const result = battle(
      { army: armyFromKeys({ JSN: 1000 }), weapons: 0, shield: 0 },
      defender({ armies: { field: armyFromKeys({ JSN: 100 }), nest: none, lodge: none } }),
      "field",
    );
    expect(result.won).toBe(true);
    expect(result.stages).toHaveLength(1);
    expect(result.stages[0]?.reply).toBe(0.1);
    // 100 JSN defend with 2 each: 200 × 0.1 = 20 damage, 2.5 JSN of 8 hp.
    expect(result.stages[0]?.attackerLost[at("JSN")]).toBe(2);
    expect(result.stages[0]?.defenderLost[at("JSN")]).toBe(100);
    expect(result.survivors[at("JSN")]).toBe(998);
  });

  it("makes defenders strike with their defense damage, not their attack", () => {
    // Tanks attack with 55 but defend with 1.
    const result = battle(
      { army: armyFromKeys({ JSN: 10 }), weapons: 0, shield: 0 },
      defender({ armies: { field: armyFromKeys({ Tk: 100 }), nest: none, lodge: none } }),
      "field",
    );
    expect(result.stages[0]?.damageDealt).toBe(30);
    expect(result.stages[0]?.attackerLost[at("JSN")]).toBe(10);
    expect(result.won).toBe(false);
  });

  it("fights on the hunting field, then in the nest, then in the lodge, with the survivors", () => {
    const result = battle(
      { army: armyFromKeys({ Tu: 1000 }), weapons: 0, shield: 0 },
      defender({
        armies: { field: armyFromKeys({ JSN: 10 }), nest: armyFromKeys({ JSN: 10 }), lodge: armyFromKeys({ C: 50 }) },
      }),
      "lodge",
    );
    expect(result.stages.map((stage) => stage.place)).toEqual(["field", "nest", "lodge"]);
    expect(result.won).toBe(true);
  });

  it("stops where the attack fails", () => {
    const result = battle(
      { army: armyFromKeys({ JSN: 100 }), weapons: 0, shield: 0 },
      defender({ armies: { field: none, nest: armyFromKeys({ Tu: 1000 }), lodge: armyFromKeys({ JSN: 1 }) } }),
      "lodge",
    );
    expect(result.stages.map((stage) => [stage.place, stage.won])).toEqual([
      ["field", true],
      ["nest", false],
    ]);
    expect(result.won).toBe(false);
    expect(result.survivors[at("JSN")]).toBe(0);
  });

  it("wins an empty place without a fight", () => {
    const result = battle({ army: armyFromKeys({ JSN: 5 }), weapons: 0, shield: 0 }, defender(), "nest");
    expect(result.won).toBe(true);
    expect(result.stages.every((stage) => stage.damageTaken === 0)).toBe(true);
  });

  it("gives the defender's hp its shield and place bonus", () => {
    // 100 JSN in the lodge, Shield 5, Lodge 2: 800 × (1 + 0.5 + 0.6) = 1 680 hp.
    expect(requiredAttack(armyFromKeys({ JSN: 100 }), 5, 0.6)).toEqual({ half: 2520, thirty: 3360, ten: 5040 });
  });
});

describe("spoils", () => {
  const won = battle({ army: armyFromKeys({ JSN: 1000 }), weapons: 0, shield: 0 }, defender(), "nest");

  it("takes 20 % of the hunting field, one cm² per surviving ant at most", () => {
    const loot = spoils(won, "field", { weapons: 0, aphids: 0, field: 3000, food: 0, materials: 0 });
    expect(loot.field).toBe(600);
    expect(spoils(won, "field", { weapons: 0, aphids: 0, field: 10_000, food: 0, materials: 0 }).field).toBe(1000);
  });

  it("loots 30 % + 1 %/aphid stable level of the nest, one resource per surviving attack point at most", () => {
    const loot = spoils(won, "nest", { weapons: 0, aphids: 5, field: 0, food: 1000, materials: 2000 });
    expect(loot).toMatchObject({ food: 350, materials: 700, colony: false });
    // 1 000 JSN keep 3 000 attack points: 35 % of 20 000 + 40 000 = 21 000 is cut to 3 000, shared out.
    const capped = spoils(won, "nest", { weapons: 0, aphids: 5, field: 0, food: 20_000, materials: 40_000 });
    expect(capped.food + capped.materials).toBe(3000);
    expect(capped.food).toBe(1000);
  });

  it("colonizes through the lodge, and wins nothing when the attack fails", () => {
    const lodge = battle({ army: armyFromKeys({ JSN: 5 }), weapons: 0, shield: 0 }, defender(), "lodge");
    expect(spoils(lodge, "lodge", { weapons: 0, aphids: 0, field: 0, food: 0, materials: 0 }).colony).toBe(true);
    const lost = battle(
      { army: armyFromKeys({ JSN: 1 }), weapons: 0, shield: 0 },
      defender({ armies: { field: armyFromKeys({ Tu: 10 }), nest: none, lodge: none } }),
      "field",
    );
    expect(spoils(lost, "field", { weapons: 0, aphids: 0, field: 5000, food: 0, materials: 0 })).toEqual({
      field: 0,
      food: 0,
      materials: 0,
      colony: false,
    });
  });
});
