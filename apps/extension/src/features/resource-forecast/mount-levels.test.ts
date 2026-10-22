import { describe, expect, it } from "vitest";
import type { ColonyState } from "@optizzz/game/forecast";
import constructionCostsHtml from "@optizzz/game/pages/__fixtures__/construction-costs.html?raw";
import laboratoryCostsHtml from "@optizzz/game/pages/__fixtures__/laboratory-costs.html?raw";
import { renderLevelsAhead } from "./mount-levels";

const now = new Date(2026, 9, 7, 12, 0);
const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");

const state: ColonyState = {
  food: 1_000_000,
  materials: 1_000_000,
  workers: 4170,
  foodWorkers: 0,
  materialWorkers: 4000,
  mushroomPerDay: 0,
  armyPerDay: 0,
  taxRate: 0,
  nextHarvestAt: now,
  hunts: [],
  newWorkersGoTo: "none",
  capacities: { food: 2_000_000, materials: 2_000_000 },
};

/** The « Niveaux suivants » table of each row, by name. */
function levels(doc: Document) {
  return Object.fromEntries(
    [...doc.querySelectorAll(".ligneAmelioration")].flatMap((row) => {
      const table = row.querySelector(".optizzz-levels table");
      const name = row.querySelector("h2")?.textContent.trim() ?? "";
      return table
        ? [
            [
              name,
              [...table.querySelectorAll("tbody tr")].map((line) =>
                [...line.querySelectorAll("td")].map((c) => c.textContent),
              ),
            ],
          ]
        : [];
    }),
  );
}

describe("renderLevelsAhead", () => {
  it("adds up the next five levels of each research, and when the stock covers them", () => {
    const doc = parse(laboratoryCostsHtml);
    renderLevelsAhead(doc, state, "research", now);
    expect(doc.querySelector(".optizzz-levels summary")?.textContent).toBe("Coût des 5 niveaux suivants");
    expect(levels(doc)["Génétique"]).toEqual([
      ["1", "3 000", "10 000", "1 000", "3 min", "maintenant"],
      ["2", "9 000", "30 000", "3 000", "9 min", "maintenant"],
      ["3", "21 000", "70 000", "7 000", "17 min", "manque 2 830 ouvrières"],
      ["4", "45 000", "150 000", "15 000", "32 min", "manque 10 830 ouvrières"],
      ["5", "93 000", "310 000", "31 000", "57 min", "manque 26 830 ouvrières"],
    ]);
  });

  it("leaves out the locked rows (Dôme), and grows the Champignonnière's cost by 1.85 a level", () => {
    const doc = parse(constructionCostsHtml);
    renderLevelsAhead(doc, state, "construction", now);
    expect(Object.keys(levels(doc))).toEqual(["Champignonnière", "Entrepôt de Nourriture", "Entrepôt de Matériaux"]);
    // Level 9 costs 12 348 materials: then 22 844, 42 261…
    expect(
      levels(doc)
        ["Champignonnière"]?.slice(0, 3)
        .map(([level, materials]) => [level, materials]),
    ).toEqual([
      ["9", "12 348"],
      ["10", "35 192"],
      ["11", "77 453"],
    ]);
    expect(doc.querySelector(".optizzz-levels .optizzz-note")?.textContent).toContain("coût × 1,85");
    // A building only costs materials: one resource column.
    expect(levels(doc)["Entrepôt de Nourriture"]?.[0]).toEqual(["6", "19 200", "32 min", "maintenant"]);
  });

  it("starts after the levels already queued", () => {
    const doc = parse(laboratoryCostsHtml);
    const queued = doc.createElement("strong");
    queued.innerHTML = `- Génétique 2 se termine dans : <span id="recherche_1"></span><script>reste(600, "recherche_1");</script>`;
    doc.body.prepend(queued);
    renderLevelsAhead(doc, state, "research", now);
    expect(levels(doc)["Génétique"]?.map(([level]) => level)).toEqual(["3", "4", "5", "6", "7"]);
  });
});
