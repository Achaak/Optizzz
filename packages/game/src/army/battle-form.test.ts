import { describe, expect, it } from "vitest";
import { emptyForm, simulate, swapSides, toBattle, type SimulatorForm } from "./battle-form";
import { battle } from "./battle";
import { armyFromKeys } from "./units";

const form: SimulatorForm = {
  attacker: { army: { JSN: 5000, Tk: 40 }, weapons: 6, shield: 5, field: 10_000, aphids: 3 },
  defender: {
    armies: { field: { JSN: 1200 }, nest: { Tk: 40 }, lodge: { JSN: 19, TuE: 5 } },
    weapons: 4,
    shield: 2,
    dome: 3,
    lodge: 1,
    field: 8_000,
    food: 100_000,
    materials: 50_000,
  },
  target: "nest",
};

describe("toBattle", () => {
  it("turns the form into the engine's input", () => {
    const { attacker, defender } = toBattle(form);
    expect(attacker).toEqual({ army: armyFromKeys({ JSN: 5000, Tk: 40 }), weapons: 6, shield: 5 });
    expect(defender.armies.lodge).toEqual(armyFromKeys({ JSN: 19, TuE: 5 }));
    expect(defender).toMatchObject({ weapons: 4, shield: 2, dome: 3, lodge: 1 });
  });

  it("gives an empty army for an empty form", () => {
    expect(toBattle(emptyForm()).attacker.army).toEqual(armyFromKeys({}));
  });
});

describe("simulate", () => {
  it("fights at each place up to the target and counts the loot", () => {
    const { attacker, defender } = toBattle(form);
    const { fought, loot } = simulate(form);
    expect(fought).toEqual(battle(attacker, defender, "nest"));
    expect(fought.stages.map((stage) => stage.place)).toEqual(["field", "nest"]);
    expect(fought.won).toBe(true);
    expect(loot.field).toBe(1600);
    expect(loot.food).toBeGreaterThan(0);
  });

  it("takes nothing from a lost attack", () => {
    const lost = simulate({ ...form, attacker: { ...form.attacker, army: { JSN: 1 } } });
    expect(lost.fought.won).toBe(false);
    expect(lost.loot).toEqual({ field: 0, food: 0, materials: 0, colony: false });
  });
});

describe("swapSides", () => {
  it("sends the defender's whole army to attack and puts the attacker's on the hunting field", () => {
    const swapped = swapSides(form);
    expect(swapped.attacker.army).toEqual({ JSN: 1219, Tk: 40, TuE: 5 });
    expect(swapped.defender.armies).toEqual({ field: { JSN: 5000, Tk: 40 }, nest: {}, lodge: {} });
  });

  it("moves Weapons, Shield and hunting field with the players, and leaves the role's own fields", () => {
    const swapped = swapSides(form);
    expect(swapped.attacker).toMatchObject({ weapons: 4, shield: 2, field: 8_000, aphids: 3 });
    expect(swapped.defender).toMatchObject({
      weapons: 6,
      shield: 5,
      field: 10_000,
      dome: 3,
      lodge: 1,
      food: 100_000,
      materials: 50_000,
    });
    expect(swapped.target).toBe("nest");
  });
});
