import { describe, expect, it } from "vitest";
import type { StatePages } from "@/data/state-pages";
import { stateReading } from "./envoi-states";

const NOW = new Date("2026-10-26T12:00:00Z");
const at = (minutes: number) => NOW.getTime() + minutes * 60_000;

const ressources: NonNullable<StatePages["ressources"]> = {
  readAt: at(-10),
  foodWorkers: 4_000,
  materialWorkers: 6_000,
  mushroomPerDay: 2_000,
  taxRate: 0.25,
  hunts: [
    { returnsAt: at(30), fieldGain: 300, troops: { JSN: 100 } },
    { returnsAt: at(-5), fieldGain: 200, troops: { JSN: 50 } },
  ],
};

const pages: StatePages = {
  stock: { readAt: at(-1), huntingField: 10_000, workers: 12_000 },
  ressources,
  colonies: {
    readAt: at(-20),
    master: "Maitre",
    colonies: [{ pseudo: "Colonie", troops: { SN: 10 }, since: at(-3000), food: 5, materials: 6 }],
  },
  armee: { readAt: at(-2), units: { JSN: 1_000, NE: 5 }, attackAnts: 400, unknownAttacks: 0, coming: [] },
  laboratory: {
    readAt: at(-30),
    levels: { weapons: 12 },
    works: [{ name: "Armes", level: 13, endsAt: at(60) }],
  },
};

/** The pages without one of them, never read. */
const without = (part: keyof StatePages): StatePages =>
  Object.fromEntries(Object.entries(pages).filter(([key]) => key !== part));

describe("stateReading", () => {
  it("makes the Production of the header, Ressources.php and colonies.php, dated by the newest", () => {
    expect(stateReading("production", pages, NOW)).toEqual({
      observedAt: at(-1),
      reading: {
        huntingField: 10_000,
        workers: 12_000,
        foodWorkers: 4_000,
        materialWorkers: 6_000,
        mushroomPerDay: 2_000,
        taxRate: 0.25,
        master: "Maitre",
        colonies: [{ pseudo: "Colonie", since: at(-3000), food: 5, materials: 6 }],
      },
    });
  });

  it("adds the stock of the header when it was kept, dated by its reading", () => {
    const stock = { readAt: at(-1), huntingField: 10_000, workers: 12_000, food: 40_000, materials: 70_000 };
    expect(stateReading("production", { ...pages, stock }, NOW)?.reading.stock).toEqual({
      food: 40_000,
      materials: 70_000,
      at: at(-1),
    });
  });

  it("adds the warehouses' capacities to the levels when construction.php gave them", () => {
    const construction = { readAt: at(-4), levels: {}, works: [], capacities: { food: 9_000, materials: 8_000 } };
    expect(stateReading("levels", { ...pages, construction }, NOW)?.reading.capacities).toEqual({
      food: 9_000,
      materials: 8_000,
    });
  });

  it("has no Production before Ressources.php is read, and unknown colonies before colonies.php", () => {
    expect(stateReading("production", { stock: pages.stock }, NOW)).toBeNull();
    const withoutColonies = without("colonies");
    expect(stateReading("production", withoutColonies, NOW)?.reading).toMatchObject({ colonies: null, master: null });
  });

  it("keeps the hunts still out", () => {
    expect(stateReading("hunts", pages, NOW)?.reading).toEqual({ hunts: [{ returnsAt: at(30), fieldGain: 300 }] });
  });

  it("counts the army present, hunting, in the colonies and attacking, with its units", () => {
    expect(stateReading("army", pages, NOW)).toEqual({
      observedAt: at(-2),
      reading: { total: 1_000 + 5 + 100 + 10 + 400, incomplete: false, returnsAt: at(30) },
      units: { JSN: 1_100, NE: 5, SN: 10 },
    });
  });

  it("says the army is incomplete when troops away are unknown", () => {
    const withoutColonies = without("colonies");
    expect(stateReading("army", withoutColonies, NOW)?.reading.incomplete).toBe(true);
    const hidden = {
      ...pages,
      ressources: { ...ressources, hunts: [{ returnsAt: at(5), fieldGain: 1, troops: null }] },
    };
    expect(stateReading("army", hidden, NOW)?.reading.incomplete).toBe(true);
  });

  it("gives the levels read, the others unknown, and the works", () => {
    expect(stateReading("levels", pages, NOW)?.reading).toEqual({
      buildings: null,
      research: { weapons: 12 },
      works: [{ name: "Armes", level: 13, endsAt: at(60) }],
    });
    expect(stateReading("levels", { stock: pages.stock }, NOW)).toBeNull();
  });
});
