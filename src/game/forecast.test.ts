import { describe, expect, it } from "vitest";
import type { WorkQueue } from "@/game/pages/work-queue";
import { balancedFoodWorkers, forecastFor, outlook, timeToAfford, type ColonyState } from "@/game/forecast";

const MINUTE = 60_000;
const now = new Date(2026, 9, 7, 12, 0);
const at = (minutes: number) => new Date(now.getTime() + minutes * MINUTE);

/** A colony with nothing moving, unless a test says otherwise. */
const colony = (overrides: Partial<ColonyState> = {}): ColonyState => ({
  food: 0,
  materials: 0,
  workers: 1000,
  foodWorkers: 0,
  materialWorkers: 0,
  mushroomPerDay: 0,
  armyPerDay: 0,
  taxRate: 0,
  nextHarvestAt: at(10),
  hunts: [],
  newWorkersGoTo: "none",
  capacities: null,
  ...overrides,
});

describe("timeToAfford", () => {
  it("is affordable now when the stock covers the cost", () => {
    expect(timeToAfford(colony({ materials: 500 }), { food: 0, materials: 500, workers: 0 }, now)).toEqual({
      kind: "now",
    });
  });

  it("counts whole harvests of 30 minutes, from the next one", () => {
    // 8 892 missing, 4 004 per harvest → 3 harvests: in 16, 46 and 76 minutes.
    const state = colony({ materials: 29508, materialWorkers: 4004, nextHarvestAt: at(16) });
    expect(timeToAfford(state, { food: 0, materials: 38400, workers: 0 }, now)).toEqual({
      kind: "at",
      at: at(76),
      blocking: "materials",
    });
  });

  it("reaches food continuously from the mushrooms, between harvests", () => {
    // 2 400 a day = 100 an hour: 150 takes 90 minutes.
    const state = colony({ mushroomPerDay: 2400 });
    expect(timeToAfford(state, { food: 150, materials: 0, workers: 0 }, now)).toEqual({
      kind: "at",
      at: at(90),
      blocking: "food",
    });
  });

  it("names the resource reached last", () => {
    // Food is there after 15 minutes, materials only after the 2nd harvest.
    const state = colony({ mushroomPerDay: 2400, materialWorkers: 50 });
    expect(timeToAfford(state, { food: 25, materials: 100, workers: 0 }, now)).toEqual({
      kind: "at",
      at: at(40),
      blocking: "materials",
    });
  });

  it("removes the colony tax from each harvest", () => {
    const state = colony({ materialWorkers: 100, taxRate: 0.5 });
    expect(timeToAfford(state, { food: 0, materials: 100, workers: 0 }, now)).toMatchObject({ at: at(40) });
  });

  it("never gets there when food only goes down", () => {
    const state = colony({ food: 100, armyPerDay: 1000 });
    expect(timeToAfford(state, { food: 200, materials: 0, workers: 0 }, now)).toEqual({ kind: "never" });
  });

  it("puts idle workers to work when a hunt brings more hunting field", () => {
    // 100 idle workers, a hunt returning in 20 minutes with 100 cm², new workers go to materials.
    const state = colony({
      workers: 100,
      newWorkersGoTo: "materials",
      hunts: [{ returnsAt: at(20), fieldGain: 100 }],
    });
    expect(timeToAfford(state, { food: 0, materials: 100, workers: 0 }, now)).toMatchObject({ at: at(40) });
  });

  it("leaves those workers idle without Compte+", () => {
    const state = colony({ workers: 100, hunts: [{ returnsAt: at(20), fieldGain: 100 }] });
    expect(timeToAfford(state, { food: 0, materials: 100, workers: 0 }, now)).toEqual({ kind: "never" });
  });

  it("rolls harvests and hunts read a while ago forward to now", () => {
    // Read 50 minutes ago: harvests at -50, -20, then 10 and 40 minutes from now.
    const state = colony({
      workers: 200,
      materialWorkers: 100,
      nextHarvestAt: at(-50),
      newWorkersGoTo: "materials",
      hunts: [{ returnsAt: at(-30), fieldGain: 100 }],
    });
    expect(timeToAfford(state, { food: 0, materials: 400, workers: 0 }, now)).toMatchObject({ at: at(40) });
  });

  it("says when a warehouse is too small for the cost", () => {
    const state = colony({ materialWorkers: 100, capacities: { food: 5000, materials: 1000 } });
    expect(timeToAfford(state, { food: 0, materials: 2000, workers: 0 }, now)).toEqual({
      kind: "warehouse",
      resource: "materials",
      capacity: 1000,
    });
  });

  it("says how many workers are missing for a research", () => {
    const state = colony({ workers: 600, materials: 10000 });
    expect(timeToAfford(state, { food: 0, materials: 100, workers: 1000 }, now)).toEqual({
      kind: "workers",
      missing: 400,
    });
  });
});

describe("outlook", () => {
  it("finds when food runs out", () => {
    // 2 400 a day = 100 an hour.
    expect(outlook(colony({ food: 100, armyPerDay: 2400 }), now).famineAt).toEqual(at(60));
  });

  it("sees no famine when harvests keep up with the army", () => {
    const state = colony({ food: 10, armyPerDay: 2400, foodWorkers: 100, nextHarvestAt: at(5) });
    expect(outlook(state, now).famineAt).toBeNull();
  });

  it("finds when each warehouse is full", () => {
    const state = colony({
      food: 900,
      mushroomPerDay: 2400,
      materialWorkers: 100,
      capacities: { food: 1000, materials: 250 },
    });
    expect(outlook(state, now)).toEqual({ famineAt: null, foodFullAt: at(60), materialsFullAt: at(70) });
  });

  it("never fills a warehouse of unknown capacity", () => {
    const state = colony({ mushroomPerDay: 2400, materialWorkers: 100 });
    expect(outlook(state, now)).toEqual({ famineAt: null, foodFullAt: null, materialsFullAt: null });
  });
});

describe("balancedFoodWorkers", () => {
  it("is the fewest food workers that keep food from ever running out", () => {
    // Upkeep of 4 800 a day = 100 per half hour: 100 food workers balance it.
    const state = colony({ food: 1000, armyPerDay: 4800, materialWorkers: 300 });
    expect(balancedFoodWorkers(state, now)).toBe(100);
  });

  it("is zero when the mushrooms cover the army", () => {
    const state = colony({ mushroomPerDay: 2400, armyPerDay: 2400, materialWorkers: 300 });
    expect(balancedFoodWorkers(state, now)).toBe(0);
  });

  it("is null when even every worker on food is not enough", () => {
    const state = colony({ armyPerDay: 48000, materialWorkers: 300 });
    expect(balancedFoodWorkers(state, now)).toBeNull();
  });
});

describe("forecastFor", () => {
  const fullQueue = (endsInMinutes: number): WorkQueue => ({
    kind: "construction",
    full: true,
    items: [
      {
        name: "Champignonnière",
        targetLevel: 9,
        endsAt: at(endsInMinutes),
        cancelHref: null,
        nextLevelDuration: null,
      },
    ],
  });
  // Materials arrive with the 3rd harvest, in 70 minutes.
  const state = colony({ materialWorkers: 100 });
  const cost = { food: 0, materials: 300, workers: 0 };

  it("only waits for resources while a slot is free", () => {
    expect(forecastFor(state, cost, { ...fullQueue(120), full: false }, now)).toMatchObject({
      readyAt: at(70),
      blockedBy: "resources",
    });
  });

  it("waits for the first item of a full queue when resources come first", () => {
    expect(forecastFor(state, cost, fullQueue(120), now)).toMatchObject({
      readyAt: at(120),
      blockedBy: "queue",
    });
  });

  it("waits for resources when they come after the slot frees up", () => {
    expect(forecastFor(state, cost, fullQueue(30), now)).toMatchObject({
      readyAt: at(70),
      blockedBy: "resources",
    });
  });

  it("waits for the queue even when the stock already covers the cost", () => {
    expect(forecastFor(colony({ materials: 300 }), cost, fullQueue(30), now)).toMatchObject({
      readyAt: at(30),
      blockedBy: "queue",
    });
  });

  it("has no date when resources never come", () => {
    expect(forecastFor(state, { ...cost, workers: 5000 }, fullQueue(30), now)).toEqual({
      affordability: { kind: "workers", missing: 4000 },
      readyAt: null,
      blockedBy: null,
    });
  });
});
