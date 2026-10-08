import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { storeCapacities, storeIncome } from "../resource-forecast/income";
import type { Income } from "../resource-forecast/pages";
import { loadServers, storeStock } from "./store";

const now = new Date(2026, 9, 8, 16, 40);
const later = new Date(2026, 9, 8, 16, 45);

const income: Income = {
  foodWorkers: 2000,
  materialWorkers: 4004,
  mushroomPerDay: 1200,
  armyPerDay: 1704,
  taxRate: 0,
  nextHarvestAt: new Date(2026, 9, 8, 16, 50),
  hunts: [{ returnsAt: new Date(2026, 9, 8, 17, 0), fieldGain: 120 }],
  newWorkersGoTo: "none",
};

describe("loadServers", () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it("gathers, per server, the stock, the income and the warehouses last read", async () => {
    await storeStock("https://s5.fourmizzz.fr", { food: 1000, materials: 2000, workers: 9000 }, later);
    await storeIncome("https://s5.fourmizzz.fr", income, now);
    await storeCapacities("https://s5.fourmizzz.fr", { food: 50_000, materials: 60_000 });
    expect(await loadServers()).toEqual([
      {
        host: "s5.fourmizzz.fr",
        stock: { food: 1000, materials: 2000, workers: 9000, readAt: later },
        income: { ...income, readAt: now },
        capacities: { food: 50_000, materials: 60_000 },
      },
    ]);
  });

  it("lists every server whose stock was read, even before Ressources", async () => {
    await storeStock("https://s5.fourmizzz.fr", { food: 1, materials: 2, workers: 3 }, now);
    await storeStock("https://s2.fourmizzz.fr", { food: 4, materials: 5, workers: 6 }, later);
    await storeStock("https://s5.fourmizzz.fr", { food: 7, materials: 8, workers: 9 }, later);
    expect(await loadServers()).toEqual([
      {
        host: "s5.fourmizzz.fr",
        stock: { food: 7, materials: 8, workers: 9, readAt: later },
        income: null,
        capacities: null,
      },
      {
        host: "s2.fourmizzz.fr",
        stock: { food: 4, materials: 5, workers: 6, readAt: later },
        income: null,
        capacities: null,
      },
    ]);
  });
});
