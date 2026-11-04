import { describe, expect, it } from "vitest";
import {
  nextStateItem,
  productionPerDay,
  STATE_REFRESH_MS,
  stateItemSchema,
  stateOfEnvoi,
  type ProductionReading,
} from "./envoi-states";

const NOW = new Date("2026-10-26T12:00:00Z");
const HOUR = 3600_000;
const DAY = 24 * HOUR;

const production: ProductionReading = {
  huntingField: 10_000,
  workers: 12_000,
  foodWorkers: 4_000,
  materialWorkers: 6_000,
  mushroomPerDay: 2_000,
  taxRate: 0.25,
  master: "Maitre",
  colonies: [{ pseudo: "Colonie", since: NOW.getTime() - 2 * DAY, food: 30_000, materials: 50_000 }],
};

describe("nextStateItem", () => {
  it("starts without a previous reading", () => {
    expect(nextStateItem("Messor", { total: 10, incomplete: false, returnsAt: null }, NOW.getTime(), null)).toEqual({
      observedAt: NOW.getTime(),
      item: { pseudo: "Messor", reading: { total: 10, incomplete: false, returnsAt: null }, previous: null },
    });
  });

  it("keeps what was sent while the reading does not change, so nothing leaves again", () => {
    const last = nextStateItem("Messor", { total: 10, incomplete: false, returnsAt: null }, NOW.getTime(), null);
    const later = NOW.getTime() + HOUR;
    expect(nextStateItem("Messor", { total: 10, incomplete: false, returnsAt: null }, later, last)).toBe(last);
  });

  it("dates an unchanged reading again after a while, keeping the previous one", () => {
    const first = nextStateItem("Messor", { total: 9, incomplete: false, returnsAt: null }, NOW.getTime() - DAY, null);
    const last = nextStateItem("Messor", { total: 10, incomplete: false, returnsAt: null }, NOW.getTime(), first);
    const later = NOW.getTime() + STATE_REFRESH_MS + 1;
    const next = nextStateItem("Messor", { total: 10, incomplete: false, returnsAt: null }, later, last);
    expect(next.observedAt).toBe(later);
    expect(next.item.previous).toEqual({ observedAt: first.observedAt, reading: first.item.reading });
  });

  it("makes the last reading sent the previous one when it changes", () => {
    const last = nextStateItem("Messor", { total: 10, incomplete: false, returnsAt: null }, NOW.getTime(), null);
    const next = nextStateItem("Messor", { total: 12, incomplete: true, returnsAt: null }, NOW.getTime() + HOUR, last);
    expect(next.item.previous).toEqual({ observedAt: NOW.getTime(), reading: last.item.reading });
  });

  describe("the stock of a Production", () => {
    const withStock = (food: number, at: number): ProductionReading => ({
      ...production,
      stock: { food, materials: 5_000, at },
    });

    it("keeps the last one sent while only the stock moved, for an hour", () => {
      const last = nextStateItem("Messor", withStock(1_000, NOW.getTime()), NOW.getTime(), null);
      const later = NOW.getTime() + HOUR - 1;
      expect(nextStateItem("Messor", withStock(2_000, later), later, last)).toBe(last);
    });

    it("sends the new stock after an hour, keeping the previous reading", () => {
      const first = nextStateItem("Messor", { ...production, taxRate: 0.2 }, NOW.getTime() - DAY, null);
      const last = nextStateItem("Messor", withStock(1_000, NOW.getTime()), NOW.getTime(), first);
      const later = NOW.getTime() + HOUR;
      const next = nextStateItem("Messor", withStock(2_000, later), later, last);
      expect(next.observedAt).toBe(later);
      expect(next.item.reading).toEqual(withStock(2_000, later));
      expect(next.item.previous).toEqual(last.item.previous);
    });

    it("sends a first stock at once", () => {
      const last = nextStateItem("Messor", production, NOW.getTime(), null);
      const later = NOW.getTime() + 60_000;
      const next = nextStateItem("Messor", withStock(2_000, later), later, last);
      expect(next.item.reading).toEqual(withStock(2_000, later));
    });

    it("sends any other change with the stock at once", () => {
      const last = nextStateItem("Messor", withStock(1_000, NOW.getTime()), NOW.getTime(), null);
      const later = NOW.getTime() + 60_000;
      const next = nextStateItem("Messor", { ...withStock(2_000, later), taxRate: 0.3 }, later, last);
      expect(next.item.previous?.reading).toEqual(last.item.reading);
    });

    it("reads a Production sent before the stock was", () => {
      const item = { pseudo: "Messor", reading: production, previous: null };
      expect(stateItemSchema("production").parse(item)).toEqual(item);
    });
  });
});

describe("productionPerDay", () => {
  it("is the harvest, less the colonizer's tax, plus what the colonies bring a day", () => {
    // (4 000 + 6 000) × 48 + 2 000 = 482 000; 25 % = 120 500; colonies: 80 000 over 2 days.
    expect(productionPerDay(production, NOW)).toEqual({
      harvest: 482_000,
      taxPaid: 120_500,
      colonies: 40_000,
      coloniesKnown: true,
      total: 401_500,
    });
  });

  it("says when the colonies are unknown: never read, or taken less than an hour ago", () => {
    expect(productionPerDay({ ...production, colonies: null }, NOW)).toMatchObject({
      coloniesKnown: false,
      colonies: 0,
    });
    const fresh = [{ pseudo: "C", since: NOW.getTime() - 20 * 60_000, food: 0, materials: 0 }];
    expect(productionPerDay({ ...production, colonies: fresh }, NOW)).toMatchObject({ coloniesKnown: false });
  });

  it("rounds the tax down, as the game does", () => {
    expect(productionPerDay({ ...production, taxRate: 0.33, colonies: [] }, NOW).taxPaid).toBe(159_060);
  });
});

describe("stateItemSchema", () => {
  it("refuses a reading of another shape", () => {
    expect(stateItemSchema("army").safeParse({ pseudo: "M", reading: { total: -1 }, previous: null }).success).toBe(
      false,
    );
  });
});

describe("stateOfEnvoi", () => {
  const context = { server: "s5", alliance: "ABC" };

  it("reads a Production Envoi as the TDC, the workers and the production, dated by its reading", () => {
    const states = stateOfEnvoi(
      "production",
      { observedAt: NOW.getTime(), item: { pseudo: "Messor", reading: production, previous: null } },
      null,
      context,
    );
    expect(states.latest).toMatchObject({ pseudo: "Messor", readAt: NOW, huntingField: 10_000, workers: 12_000 });
    expect(states.latest.production?.colonies?.[0]?.since).toEqual(new Date(NOW.getTime() - 2 * DAY));
    expect(states.previous).toBeUndefined();
  });

  it("reads the stock of a Production and the capacities of the levels", () => {
    const stock = { food: 1_000, materials: 2_000, at: NOW.getTime() - HOUR };
    const withStock = stateOfEnvoi(
      "production",
      { observedAt: NOW.getTime(), item: { pseudo: "Messor", reading: { ...production, stock }, previous: null } },
      null,
      context,
    );
    expect(withStock.latest.stock).toEqual({ food: 1_000, materials: 2_000, at: new Date(NOW.getTime() - HOUR) });
    const levels = stateOfEnvoi(
      "levels",
      {
        observedAt: NOW.getTime(),
        item: {
          pseudo: "Messor",
          reading: { buildings: null, research: null, works: null, capacities: { food: 9, materials: 8 } },
          previous: null,
        },
      },
      null,
      context,
    );
    expect(levels.latest.capacities).toEqual({ food: 9, materials: 8 });
  });

  it("puts the units of the Admins' blob in the army, and keeps the previous reading", () => {
    const states = stateOfEnvoi(
      "army",
      {
        observedAt: NOW.getTime(),
        item: {
          pseudo: "Messor",
          reading: { total: 12, incomplete: true, returnsAt: NOW.getTime() + HOUR },
          previous: { observedAt: NOW.getTime() - DAY, reading: { total: 10, incomplete: false, returnsAt: null } },
        },
      },
      { JSN: 12 },
      context,
    );
    expect(states.latest.army).toEqual({
      total: 12,
      incomplete: true,
      returnsAt: new Date(NOW.getTime() + HOUR),
      units: { JSN: 12 },
    });
    expect(states.previous?.army).toEqual({ total: 10, incomplete: false });
    expect(states.previous?.readAt).toEqual(new Date(NOW.getTime() - DAY));
  });

  it("reads hunts, levels and works", () => {
    const hunts = stateOfEnvoi(
      "hunts",
      {
        observedAt: NOW.getTime(),
        item: { pseudo: "M", reading: { hunts: [{ returnsAt: NOW.getTime(), fieldGain: 300 }] }, previous: null },
      },
      null,
      context,
    );
    expect(hunts.latest.hunts).toEqual([{ returnsAt: NOW, fieldGain: 300 }]);
    const levels = stateOfEnvoi(
      "levels",
      {
        observedAt: NOW.getTime(),
        item: {
          pseudo: "M",
          reading: {
            buildings: { dome: 4 },
            research: null,
            works: [{ name: "Dôme", level: 5, endsAt: NOW.getTime() }],
          },
          previous: null,
        },
      },
      null,
      context,
    );
    expect(levels.latest).toMatchObject({ buildings: { dome: 4 }, works: [{ name: "Dôme", level: 5, endsAt: NOW }] });
    expect(levels.latest).not.toHaveProperty("research");
  });
});
