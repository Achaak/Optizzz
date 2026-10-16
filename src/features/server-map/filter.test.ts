import { describe, expect, it } from "vitest";
import type { Player } from "@/data/exports";
import { inRange } from "@/game/attack";
import { attackableBounds, filterSummary, isFiltering, passesFilter, setBound, type ChipFilter } from "./filter";

const player = (fields: Partial<Player>): Player => ({
  id: 1,
  pseudo: "A",
  alliance: null,
  masterPlayerId: null,
  x: 0,
  y: 0,
  field: 1000,
  grade: null,
  buildingScore: 0,
  technologyScore: 0,
  trophyScore: 0,
  onHoliday: false,
  isBanned: false,
  ...fields,
});

describe("passesFilter", () => {
  const filter: ChipFilter = { buildingScore: { min: 10, max: 20 }, field: { min: 10_000, max: null } };

  it("keeps a player within every bound, bounds included", () => {
    expect(passesFilter(player({ buildingScore: 10, field: 10_000 }), filter)).toBe(true);
    expect(passesFilter(player({ buildingScore: 20, field: 50_000 }), filter)).toBe(true);
  });

  it("drops a player outside any bound", () => {
    expect(passesFilter(player({ buildingScore: 21, field: 50_000 }), filter)).toBe(false);
    expect(passesFilter(player({ buildingScore: 15, field: 9_999 }), filter)).toBe(false);
  });

  it("keeps everyone without a filter", () => {
    expect(passesFilter(player({}), undefined)).toBe(true);
    expect(passesFilter(player({}), {})).toBe(true);
  });
});

describe("setBound", () => {
  it("sets one bound and drops a criterion left without any", () => {
    let filter = setBound(undefined, "field", "min", 10_000);
    expect(filter).toEqual({ field: { min: 10_000, max: null } });
    filter = setBound(filter, "technologyScore", "max", 30);
    filter = setBound(filter, "field", "min", null);
    expect(filter).toEqual({ technologyScore: { min: null, max: 30 } });
    expect(isFiltering(filter)).toBe(true);
    expect(isFiltering(setBound(filter, "technologyScore", "max", null))).toBe(false);
  });
});

describe("attackableBounds", () => {
  it("bounds the TDC as the attack range does, limits included", () => {
    for (const mine of [12_345, 10_000, 1]) {
      const { min, max } = attackableBounds(mine);
      if (min === null || max === null) throw new Error("open bounds");
      expect([inRange(mine, min - 1), inRange(mine, min), inRange(mine, max), inRange(mine, max + 1)]).toEqual([
        false,
        true,
        true,
        false,
      ]);
    }
  });
});

describe("filterSummary", () => {
  it("writes each bound as the game names the scores, numbers as the game", () => {
    expect(
      filterSummary({
        field: { min: 10_000, max: null },
        buildingScore: { min: 10, max: 20 },
        technologyScore: { min: null, max: 30 },
      }),
    ).toBe("TDC ≥ 10 000 · Fourmilière 10 à 20 · Technologie ≤ 30");
    expect(filterSummary(undefined)).toBe("");
  });
});
