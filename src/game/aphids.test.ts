import { describe, expect, it } from "vitest";
import { lootShare, payback, spareWorkers, stableGain, workersNeeded } from "./aphids";

describe("workersNeeded", () => {
  it("takes one worker per 10 resources, 5 % more per aphid stable level", () => {
    expect(workersNeeded(1, 0)).toBe(1);
    expect(workersNeeded(10_000, 0)).toBe(1000);
    expect(workersNeeded(10_000, 4)).toBe(834);
  });
});

describe("lootShare", () => {
  it("takes 30 % of the nest's stock, 1 % more per level", () => {
    expect(lootShare(0)).toBe(0.3);
    expect(lootShare(5)).toBeCloseTo(0.35, 12);
  });
});

describe("stableGain", () => {
  it("adds 1 % of each colony's most harvest a day (TDC × 48)", () => {
    // 100 000 cm²: 4 800 000 a day, taxed 25 % then 26 %; 50 000 cm²: 2 400 000.
    expect(stableGain(5, [100_000, 50_000], null)).toEqual({
      colonies: 2,
      daily: 48_000 + 24_000,
      workersSaved: 3076,
      spare: null,
      extraLoad: null,
    });
  });

  it("saves workers on a million sent: 80 000 at level 5, 76 924 at level 6", () => {
    expect(stableGain(5, [], null).workersSaved).toBe(80_000 - 76_924);
  });

  it("brings nothing a day without a colony, or when they are unknown", () => {
    expect(stableGain(5, [], null).daily).toBe(0);
    expect(stableGain(5, null, null)).toMatchObject({ colonies: null, daily: 0 });
  });
});

describe("spareWorkers", () => {
  it("counts the workers at home and carrying convoys, less one per cm² of TDC", () => {
    const convoys = [
      { food: 50_000, materials: 0, arrivesAt: new Date("2026-10-19T12:00:00Z") },
      { food: 0, materials: 30_000, arrivesAt: new Date("2026-10-19T09:00:00Z") },
    ];
    // At level 5 a worker carries 12.5: the convoy still on its way takes 4 000.
    expect(spareWorkers({ atHome: 20_000, huntingField: 15_000 }, convoys, 5, new Date("2026-10-19T10:00:00Z"))).toBe(
      9_000,
    );
  });

  it("is never below zero", () => {
    expect(spareWorkers({ atHome: 10_000, huntingField: 15_000 }, [], 5, new Date())).toBe(0);
  });
});

describe("stableGain, convoys", () => {
  it("adds half a resource per spare worker on each trip: 5 % of 10", () => {
    expect(stableGain(5, [], 9_000)).toMatchObject({ spare: 9_000, extraLoad: 4_500 });
  });
});

describe("payback", () => {
  it("counts the whole days (or trips) the gain takes to pay the cost", () => {
    expect(payback(496_000, 72_000)).toBe(7);
    expect(payback(72_000, 72_000)).toBe(1);
  });

  it("is null without a gain", () => {
    expect(payback(496_000, 0)).toBeNull();
  });
});
