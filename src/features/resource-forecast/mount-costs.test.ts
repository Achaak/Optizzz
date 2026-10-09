import { describe, expect, it } from "vitest";
import type { WorkQueue } from "@/game/pages/work-queue";
import constructionCostsHtml from "./__fixtures__/construction-costs.html?raw";
import laboratoryCostsHtml from "./__fixtures__/laboratory-costs.html?raw";
import type { ColonyState } from "@/game/forecast";
import { renderCostForecasts } from "./mount-costs";

const MINUTE = 60_000;
const now = new Date(2026, 9, 7, 12, 0);
const at = (minutes: number) => new Date(now.getTime() + minutes * MINUTE);
const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");

const state: ColonyState = {
  food: 0,
  materials: 15000,
  workers: 4170,
  foodWorkers: 0,
  materialWorkers: 4000,
  mushroomPerDay: 0,
  armyPerDay: 0,
  taxRate: 0,
  nextHarvestAt: at(16),
  hunts: [],
  newWorkersGoTo: "none",
  capacities: { food: 38900, materials: 77300 },
};

/** Forecast line of each row (in its wide description cell), by name; rows without one are left out. */
function forecasts(doc: Document) {
  return Object.fromEntries(
    [...doc.querySelectorAll(".ligneAmelioration")].flatMap((row) => {
      const line = row.querySelector(".desciption_amelioration > .optizzz-forecast");
      const name = row.querySelector("h2")?.textContent ?? "";
      return line ? [[name, line.textContent.replace(/\s+/g, " ").trim()]] : [];
    }),
  );
}

describe("renderCostForecasts", () => {
  it("adds when each building becomes affordable, and what is missing", () => {
    const doc = parse(constructionCostsHtml);
    renderCostForecasts(doc, state, null, now);
    expect(forecasts(doc)).toEqual({
      "Entrepôt de Nourriture": "Disponible dans 46 min (aujourd'hui 12 h 46) · manque 4 200 matériaux",
      // The game shows its own time left on this row (Compte+ clock): only the hour is added.
      "Entrepôt de Matériaux": "Disponible aujourd'hui 14 h 46 · manque 23 400 matériaux",
    });
  });

  it("waits for the queue when it is full, even for an affordable building", () => {
    const queue: WorkQueue = {
      kind: "construction",
      full: true,
      items: [{ name: "Couveuse", targetLevel: 7, endsAt: at(65), cancelHref: null, nextLevelDuration: null }],
    };
    const doc = parse(constructionCostsHtml);
    renderCostForecasts(doc, state, queue, now);
    expect(forecasts(doc)).toMatchObject({
      Champignonnière: "Disponible dans 1 h 05 (aujourd'hui 13 h 05) · file pleine",
      "Entrepôt de Nourriture": "Disponible dans 1 h 05 (aujourd'hui 13 h 05) · file pleine · manque 4 200 matériaux",
    });
  });

  it("explains research that cannot be reached", () => {
    const doc = parse(laboratoryCostsHtml);
    renderCostForecasts(doc, { ...state, food: 100, armyPerDay: 1000, workers: 170 }, null, now);
    expect(forecasts(doc)).toEqual({
      "Vitesse d'attaque": "Jamais au rythme actuel · manque 2 900 nourriture",
      Génétique: "Il manque 830 ouvrières",
    });
  });

  it("says when a warehouse is too small", () => {
    const doc = parse(constructionCostsHtml);
    renderCostForecasts(doc, { ...state, capacities: { food: 38900, materials: 20000 } }, null, now);
    expect(forecasts(doc)).toMatchObject({ "Entrepôt de Matériaux": "Entrepôt trop petit (capacité 20 000)" });
  });

  it("counts down from when the stock was read", () => {
    const doc = parse(constructionCostsHtml);
    renderCostForecasts(doc, state, null, now, at(30));
    expect(forecasts(doc)["Entrepôt de Nourriture"]).toBe(
      "Disponible dans 16 min (aujourd'hui 12 h 46) · manque 4 200 matériaux",
    );
  });

  it("redraws without piling lines up", () => {
    const doc = parse(constructionCostsHtml);
    renderCostForecasts(doc, state, null, now);
    renderCostForecasts(doc, state, null, at(1));
    expect(doc.querySelectorAll(".optizzz-forecast")).toHaveLength(2);
  });
});
