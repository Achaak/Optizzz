import { describe, expect, it } from "vitest";
import conversationsHtml from "./__fixtures__/combat-conversations.html?raw";
import { combatWeapons, readCombat, readCombatConversation, readLoot } from "./combat-reports";

const doc = () => new DOMParser().parseFromString(conversationsHtml, "text/html");
const conversation = (n: number) => {
  const found = doc().querySelectorAll(".contenu_conversation")[n];
  if (!found) throw new Error("fixture");
  return found;
};

describe("readCombat", () => {
  it("reads a won attack on the hunting field", () => {
    const [combat] = readCombatConversation(conversation(0)).combats;
    expect(combat).toEqual({
      date: "16/10/26 14h58",
      place: "field",
      opponent: "Fourmi_Alpha",
      occupied: false,
      attackers: { JSN: 5531, SN: 485, NE: 29 },
      defenders: { JSN: 10 },
      dealt: { base: 19221, bonus: 9611 },
      killed: 10,
      taken: { base: 2, bonus: 2 },
      lost: 0,
      won: true,
    });
  });

  it("reads a failed attack on the nest held by an occupying army", () => {
    const [combat] = readCombatConversation(conversation(2)).combats;
    expect(combat).toMatchObject({
      place: "nest",
      opponent: "Fourmi_Beta",
      occupied: true,
      attackers: { JSN: 1 },
      defenders: { TuE: 28892 },
      dealt: { base: 3, bonus: 0 },
      killed: 0,
      taken: { base: 1589060, bonus: 4926086 },
      lost: 1,
      won: false,
    });
  });

  it("is null for a text that is no attack", () => {
    expect(readCombat("", "Vos fourmis ont conquis 10 cm² lors de leur dernière bataille.")).toBeNull();
  });

  it("keeps units the game names but the engine does not know, by their name", () => {
    const text =
      "Vous attaquez la Loge Impériale de X Troupes en attaque : 3 Licornes. Troupes en défense : 2 Tanks. " +
      "Vous infligez 9 (+ 0) dégâts et tuez 0 ennemies. L’ennemie inflige 1 (+ 0) dégâts à vos fourmis et en tue 0.";
    expect(readCombat("d", text)).toMatchObject({ place: "lodge", attackers: { Licornes: 3 }, defenders: { Tk: 2 } });
  });
});

describe("combatWeapons", () => {
  it("is the Weapons level the bonus shows: 10 % of the base damage per level", () => {
    expect(combatWeapons({ base: 19221, bonus: 9611 })).toBe(5);
    expect(combatWeapons({ base: 1589060, bonus: 4926086 })).toBe(31);
  });

  it("is unknown without damage, or with a few points rounded too much to tell", () => {
    expect(combatWeapons({ base: 0, bonus: 0 })).toBeNull();
    expect(combatWeapons({ base: 3, bonus: 0 })).toBeNull();
    expect(combatWeapons({ base: 2, bonus: 2 })).toBeNull();
  });
});

describe("readLoot", () => {
  it("reads the field and the resources taken, and from whom", () => {
    const { loots } = readCombatConversation(conversation(3));
    expect(loots).toEqual([
      { date: "19/10/26 11h45", opponent: "Fourmi_Atta", field: 10, food: 0, materials: 0 },
      { date: "19/10/26 11h45", opponent: "Fourmi_Atta", field: 0, food: 15, materials: 15 },
    ]);
  });

  it("reads thousands", () => {
    expect(
      readLoot("d", "Vos fourmis ont conquis 6 044 cm² lors de leur dernière bataille. Ces terres appartenaient à X."),
    ).toEqual({ date: "d", opponent: "X", field: 6044, food: 0, materials: 0 });
  });

  it("is null for a colony or a fight", () => {
    const { combats, loots } = readCombatConversation(conversation(4));
    expect(combats).toEqual([]);
    expect(loots).toEqual([]);
  });
});
