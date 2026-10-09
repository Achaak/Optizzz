import { describe, expect, it } from "vitest";
import constructionHtml from "@/features/game-levels/__fixtures__/construction.html?raw";
import laboratoryHtml from "@/features/game-levels/__fixtures__/laboratory.html?raw";
import { readBuildingLevels, readResearchLevels } from "./levels";

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");

describe("readBuildingLevels", () => {
  it("reads every building of construction.php, whatever the accents", () => {
    expect(readBuildingLevels(parse(constructionHtml))).toEqual({
      mushroom: 8,
      dome: 3,
      lodge: 1,
      aphids: 4,
      cochineal: 2,
    });
  });

  it("keeps the current level of a building under construction", () => {
    const doc = parse(
      `<table><tr class="ligneAmelioration"><td class="desciption_amelioration"><h2>Dôme</h2><span class="niveau_amelioration">niveau 8 -> 9</span></td></tr></table>`,
    );
    expect(readBuildingLevels(doc)).toEqual({ dome: 8 });
  });
});

describe("readResearchLevels", () => {
  it("reads every research of laboratoire.php", () => {
    expect(readResearchLevels(parse(laboratoryHtml))).toEqual({
      laying: 5,
      shield: 4,
      weapons: 4,
      huntSpeed: 3,
      attackSpeed: 0,
    });
  });
});
