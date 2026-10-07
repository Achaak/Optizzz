import { describe, expect, it } from "vitest";
import { armyFromKeys } from "@/game/army/units";
import { emptyForm, prefill, readArmyText, toBattle } from "./form";
import type { Garrison } from "./garrison";

const garrison: Garrison = {
  armies: {
    field: armyFromKeys({ JSN: 1200 }),
    nest: armyFromKeys({ Tk: 40 }),
    lodge: armyFromKeys({ JSN: 19, TuE: 5 }),
  },
  dome: 3,
  lodge: 1,
  field: 4496,
};
const levels = { weapons: 4, shield: 5, aphids: 2 };

describe("prefill", () => {
  it("puts the whole army on the attacking side", () => {
    const form = prefill(emptyForm(), "attack", garrison, levels);
    expect(form.attacker).toEqual({
      army: { JSN: 1219, Tk: 40, TuE: 5 },
      weapons: 4,
      shield: 5,
      field: 4496,
      aphids: 2,
    });
    expect(form.defender).toEqual(emptyForm().defender);
  });

  it("puts each place's army, the dome and the lodge on the defending side", () => {
    const form = prefill(emptyForm(), "defend", garrison, levels);
    expect(form.defender).toMatchObject({
      armies: { field: { JSN: 1200 }, nest: { Tk: 40 }, lodge: { JSN: 19, TuE: 5 } },
      weapons: 4,
      shield: 5,
      dome: 3,
      lodge: 1,
      field: 4496,
    });
    expect(form.attacker).toEqual(emptyForm().attacker);
  });

  it("keeps the form as is without a remembered garrison, levels aside", () => {
    expect(prefill(emptyForm(), "attack", null, {}).attacker).toEqual(emptyForm().attacker);
  });
});

describe("readArmyText", () => {
  const report = `Troupes en attaque : 1 921 Jeunes Soldates Naines, 119 Soldates Naines.
    Troupes en défense : 300 Jeunes Soldates, 2 Tanks d’élite.
    Vous infligez 6 358 (+ 2 544) dégâts`;

  it("takes the defending troops of a pasted report", () => {
    expect(readArmyText(report, "defense")).toEqual({ army: { JS: 300, TkE: 2 }, unknown: [] });
  });

  it("takes the attacking troops, or a plain list, and tells which names it does not know", () => {
    expect(readArmyText(report, "attack").army).toEqual({ JSN: 1921, SN: 119 });
    expect(readArmyText("50 Tueuses, 3 Fourmis volantes", "defense")).toEqual({
      army: { Tu: 50 },
      unknown: ["Fourmis volantes"],
    });
  });
});

describe("toBattle", () => {
  it("turns the form into the engine's input", () => {
    const form = prefill(emptyForm(), "defend", garrison, levels);
    const { attacker, defender } = toBattle(form);
    expect(attacker.army).toEqual(armyFromKeys({}));
    expect(defender.armies.lodge).toEqual(armyFromKeys({ JSN: 19, TuE: 5 }));
    expect(defender).toMatchObject({ weapons: 4, shield: 5, dome: 3, lodge: 1 });
  });
});
