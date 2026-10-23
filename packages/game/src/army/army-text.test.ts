import { describe, expect, it } from "vitest";
import { armyToCounts, countsToArmy, readArmyText } from "./army-text";
import { armyFromKeys } from "./units";

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

  it("adds up a unit written twice", () => {
    expect(readArmyText("10 Tanks, 5 Tank", "attack").army).toEqual({ Tk: 15 });
  });
});

describe("counts and armies", () => {
  it("go from one to the other, without the units at 0", () => {
    const army = armyFromKeys({ JSN: 12, TuE: 3 });
    expect(armyToCounts(army)).toEqual({ JSN: 12, TuE: 3 });
    expect(countsToArmy({ JSN: 12, TuE: 3, S: undefined })).toEqual(army);
  });
});
