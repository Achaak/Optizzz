import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import coloniesHtml from "@optizzz/game/pages/__fixtures__/colonies.html?raw";
import constructionHtml from "@optizzz/game/pages/__fixtures__/construction.html?raw";
import laboratoryHtml from "@optizzz/game/pages/__fixtures__/laboratory.html?raw";
import ressourcesHtml from "@optizzz/game/pages/__fixtures__/ressources.html?raw";
import armeeHtml from "../features/flood/__fixtures__/armee-attacks-s5.html?raw";
import garrisonHtml from "../features/combat-simulator/__fixtures__/armee.html?raw";
import { readStock } from "@optizzz/game/pages/resources";
import { htmlElement } from "@/utils/html";
import { keepStatePages, loadStatePages, readStatePages, type StatePart } from "./state-pages";

const S5 = "https://s5.fourmizzz.fr";
const NOW = new Date("2026-10-26T12:00:00Z");
const ALL = new Set<StatePart>(["stock", "ressources", "colonies", "armee", "construction", "laboratory"]);
const HEADER =
  '<div id="data"><span id="nb_nourriture">1</span><span id="nb_materiaux">2</span><span id="nb_ouvrieres">300</span><span id="quantite_tdc">400</span></div>';

/** A game page, with the header every logged-in page has (some fixtures keep only their own part). */
function parse(html: string): Document {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!readStock(doc)) {
    doc.querySelector("#data")?.remove();
    doc.body.prepend(htmlElement(doc, "div", HEADER));
  }
  return doc;
}

beforeEach(() => {
  fakeBrowser.reset();
});

describe("readStatePages", () => {
  it("reads the header everywhere, and each page's own part on that page only", () => {
    const read = readStatePages(parse(ressourcesHtml), "/ressources.php", ALL, [], NOW);
    expect(Object.keys(read).sort()).toEqual(["ressources", "stock"]);
    expect(read.stock?.readAt).toBe(NOW.getTime());
    expect(read.stock?.food).toBeGreaterThanOrEqual(0);
    expect(read.stock?.materials).toBeGreaterThanOrEqual(0);
    expect(read.ressources?.hunts.length).toBeGreaterThan(0);
    expect(read.ressources?.hunts[0]?.returnsAt).toBeGreaterThan(NOW.getTime());
    // The game's number for the hunt, for the hunts log.
    expect(read.ressources?.hunts[0]?.id).toEqual(expect.any(Number));
  });

  it("reads only the parts wanted", () => {
    expect(readStatePages(parse(ressourcesHtml), "/ressources.php", new Set(["stock"]), [], NOW)).toEqual({
      stock: expect.any(Object) as unknown,
    });
  });

  it("reads the colonies with the date each was taken and what it brought", () => {
    const read = readStatePages(parse(coloniesHtml), "/colonies.php", ALL, [], NOW);
    expect(read.colonies).toEqual({
      readAt: NOW.getTime(),
      master: "Maitre_1",
      colonies: [
        {
          pseudo: "Colonie_1",
          troops: { JSN: 10 },
          since: NOW.getTime() - (24 * 60 + 42) * 1000,
          food: 0,
          materials: 0,
        },
      ],
    });
  });

  it("reads the garrison, the attacks on their way and the troops coming back on Armee.php", () => {
    const doc = parse(garrisonHtml);
    const attacks = new DOMParser().parseFromString(armeeHtml, "text/html").querySelector("#centre center");
    doc.querySelector("#centre")?.append(...(attacks?.childNodes ?? []));
    const launch = {
      targetId: 1,
      target: "Cible_1",
      ants: 4047,
      take: 100,
      arrivesAt: new Date(NOW.getTime() + 11_700_000),
    };
    const armee = readStatePages(doc, "/armee.php", ALL, [launch], NOW).armee;
    expect(armee).toMatchObject({ readAt: NOW.getTime(), attackAnts: 4047, unknownAttacks: 1, coming: [] });
    expect(Object.values(armee?.units ?? {}).length).toBeGreaterThan(0);
    expect(Object.values(armee?.units ?? {}).every((count) => count > 0)).toBe(true);
  });

  it("reads all the levels and the works of construction.php and laboratoire.php", () => {
    const construction = readStatePages(parse(constructionHtml), "/construction.php", ALL, [], NOW).construction;
    expect(Object.keys(construction?.levels ?? {}).length).toBeGreaterThan(3);
    const laboratory = readStatePages(parse(laboratoryHtml), "/laboratoire.php", ALL, [], NOW).laboratory;
    expect(laboratory?.levels.weapons).toEqual(expect.any(Number));
  });

  it("reads nothing on a page without session", () => {
    const doc = new DOMParser().parseFromString("<p>Session expirée</p>", "text/html");
    expect(readStatePages(doc, "/ressources.php", ALL, [], NOW)).toEqual({});
  });
});

describe("keepStatePages", () => {
  it("replaces each part read and keeps the others", async () => {
    await keepStatePages(S5, { stock: { readAt: 1, huntingField: 10, workers: 20 } });
    await keepStatePages(S5, { laboratory: { readAt: 2, levels: { weapons: 3 }, works: [] } });
    await keepStatePages(S5, { stock: { readAt: 3, huntingField: 11, workers: 20 } });
    expect(await loadStatePages(S5)).toEqual({
      stock: { readAt: 3, huntingField: 11, workers: 20 },
      laboratory: { readAt: 2, levels: { weapons: 3 }, works: [] },
    });
  });
});
