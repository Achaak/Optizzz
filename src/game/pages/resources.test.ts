import { describe, expect, it } from "vitest";
import ressourcesHtml from "@/features/resource-forecast/__fixtures__/ressources.html?raw";
import ressourcesColonizedHtml from "@/features/resource-forecast/__fixtures__/ressources-colonized.html?raw";
import constructionCostsHtml from "@/features/resource-forecast/__fixtures__/construction-costs.html?raw";
import laboratoryCostsHtml from "@/features/resource-forecast/__fixtures__/laboratory-costs.html?raw";
import { readCapacities, readCosts, readIncome, readStock } from "@/game/pages/resources";

const now = new Date(2026, 9, 7, 12, 7, 0);
const inSeconds = (seconds: number) => new Date(now.getTime() + seconds * 1000);
const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");

describe("readStock", () => {
  it("reads the exact stock from the hidden header data", () => {
    expect(readStock(parse(ressourcesHtml))).toEqual({
      food: 2883.1475837896,
      materials: 29508,
      workers: 4170,
      huntingField: 4004,
    });
  });
});

describe("readIncome", () => {
  it("reads workers, daily production and upkeep, next harvest and hunts (no `var champi` here)", () => {
    expect(readIncome(parse(ressourcesHtml), now)).toEqual({
      foodWorkers: 0,
      materialWorkers: 4004,
      mushroomPerDay: 5022,
      armyPerDay: 1704,
      taxRate: 0,
      nextHarvestAt: inSeconds(977),
      hunts: [{ returnsAt: inSeconds(1090), fieldGain: 122 }],
      newWorkersGoTo: "materials",
    });
  });

  it("reads the colony tax and leaves new workers idle without Compte+", () => {
    expect(readIncome(parse(ressourcesColonizedHtml), now)).toMatchObject({
      foodWorkers: 6360,
      materialWorkers: 25439,
      mushroomPerDay: 1721321.5369331,
      armyPerDay: 320058,
      taxRate: 0.43,
      nextHarvestAt: inSeconds(581),
      hunts: [{ returnsAt: inSeconds(6904), fieldGain: 423 }],
      newWorkersGoTo: "none",
    });
  });

  it("returns null outside Ressources.php", () => {
    expect(readIncome(parse("<p>Reine</p>"), now)).toBeNull();
  });
});

describe("readCosts", () => {
  const costs = (html: string) => readCosts(parse(html)).map(({ name, cost, locked }) => ({ name, cost, locked }));

  it("reads buildings, which cost materials only, and spots missing requirements", () => {
    expect(costs(constructionCostsHtml)).toEqual([
      { name: "Champignonnière", cost: { food: 0, materials: 12348, workers: 0 }, locked: false },
      { name: "Entrepôt de Nourriture", cost: { food: 0, materials: 19200, workers: 0 }, locked: false },
      { name: "Entrepôt de Matériaux", cost: { food: 0, materials: 38400, workers: 0 }, locked: false },
      { name: "Dôme", cost: { food: 0, materials: 100000, workers: 0 }, locked: true },
    ]);
  });

  it("reads research, which costs workers, food and materials", () => {
    expect(costs(laboratoryCostsHtml)).toEqual([
      { name: "Vitesse d'attaque", cost: { food: 3000, materials: 1000, workers: 0 }, locked: false },
      { name: "Génétique", cost: { food: 3000, materials: 10000, workers: 1000 }, locked: false },
    ]);
  });
});

describe("readCapacities", () => {
  it("reads both warehouses' current capacity", () => {
    expect(readCapacities(parse(constructionCostsHtml))).toEqual({ food: 38900, materials: 77300 });
  });

  it("returns null when the warehouses are not on the page", () => {
    expect(readCapacities(parse(laboratoryCostsHtml))).toBeNull();
  });
});
