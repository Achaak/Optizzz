import { describe, expect, it } from "vitest";
import armyHtml from "@/features/combat-simulator/__fixtures__/armee.html?raw";
import attacksHtml from "@/features/flood/__fixtures__/armee-attacks.html?raw";
import constructionHtml from "@/features/game-levels/__fixtures__/construction.html?raw";
import laboratoryHtml from "@/features/game-levels/__fixtures__/laboratory.html?raw";
import huntsHtml from "@/features/hunt-launcher/__fixtures__/ressources-hunts.html?raw";
import { collectMyState, type ShareChoices } from "./my-state";

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");
const now = new Date("2026-10-09T10:00:00Z");
const me = { server: "s5", alliance: "TAG", pseudo: "Me" };
const everything: ShareChoices = {
  buildings: true,
  research: true,
  works: true,
  workers: true,
  huntingField: true,
  army: "units",
};
const pages = {
  construction: parse(constructionHtml),
  laboratory: parse(laboratoryHtml),
  army: parse(armyHtml),
  resources: parse(huntsHtml),
};

describe("collectMyState", () => {
  it("gathers what the pages show, the troops out hunting (Compte+) added to the garrison", () => {
    expect(collectMyState(pages, everything, me, [], now)).toEqual({
      state: {
        ...me,
        readAt: now,
        huntingField: 4004,
        workers: 4170,
        buildings: { mushroom: 8, dome: 3, lodge: 1, aphids: 4, cochineal: 2 },
        research: { laying: 5, shield: 4, weapons: 4, huntSpeed: 3, attackSpeed: 0 },
        works: [],
        army: {
          // Garrison: 1 219 JSN, 40 Tk, 5 TuE; hunts: 2 275 JSN, 124 SN, 1 Tk.
          total: 3664,
          units: { JSN: 3494, SN: 124, Tk: 41, TuE: 5 },
          incomplete: false,
          returnsAt: new Date(now.getTime() + 3725_000),
        },
      },
      missing: [],
    });
  });

  it("only shares what the player chose, the army as a number only", () => {
    const choices: ShareChoices = { ...everything, buildings: false, works: false, workers: false, army: "total" };
    const { state } = collectMyState(pages, choices, me, [], now);
    expect(state).toEqual({
      ...me,
      readAt: now,
      huntingField: 4004,
      research: { laying: 5, shield: 4, weapons: 4, huntSpeed: 3, attackSpeed: 0 },
      army: { total: 3664, incomplete: false, returnsAt: new Date(now.getTime() + 3725_000) },
    });
  });

  it("calls the army incomplete when a hunt's troops are not shown (no Compte+)", () => {
    const withoutCompte = parse(huntsHtml.replace(/Troupes en chasses : 300[^<]*/, ""));
    const { state } = collectMyState({ ...pages, resources: withoutCompte }, everything, me, [], now);
    expect(state.army).toMatchObject({ total: 3363, incomplete: true });
  });

  it("adds the ants of the attacks sent with the flood plan, and calls an attack sent without it unknown", () => {
    const attacks = /<h3>Attaque[\s\S]*(?=<\/center>)/.exec(attacksHtml)?.[0] ?? "";
    const army = parse(armyHtml.replace(/<\/div>\s*$/, `${attacks}</div>`));
    const launch = {
      targetId: 1,
      target: "Cible_1",
      ants: 500,
      take: 100,
      arrivesAt: new Date(now.getTime() + 547_000),
    };
    const { state } = collectMyState({ ...pages, army }, { ...everything, army: "total" }, me, [launch], now);
    expect(state.army).toMatchObject({ total: 4164, incomplete: true });
  });

  it("names the pages that could not be read, and leaves out what they hold", () => {
    const { state, missing } = collectMyState({ ...pages, laboratory: null, army: null }, everything, me, [], now);
    expect(missing).toEqual(["Laboratoire", "Armée"]);
    expect(state.research).toBeUndefined();
    expect(state.army).toBeUndefined();
  });
});
