import { describe, expect, it } from "vitest";
import { armyFromKeys, UNITS } from "./army/units";
import { keepProbes, PLACES, placesWithoutProbe, probeMoves } from "./probes";

const unit = (key: string) => UNITS.findIndex((candidate) => candidate.key === key);

describe("placesWithoutProbe", () => {
  it("lists the watched places without a single ant", () => {
    const armies = { field: armyFromKeys({ JSN: 10 }), nest: armyFromKeys({}), lodge: armyFromKeys({}) };
    expect(placesWithoutProbe(armies, PLACES)).toEqual(["nest", "lodge"]);
    expect(placesWithoutProbe(armies, ["field", "lodge"])).toEqual(["lodge"]);
  });
});

describe("probeMoves", () => {
  it("moves the cheapest unit from where there are the most of it", () => {
    const armies = {
      field: armyFromKeys({ JSN: 5, Tk: 40 }),
      nest: armyFromKeys({ JSN: 900 }),
      lodge: armyFromKeys({}),
    };
    expect(probeMoves(armies, PLACES)).toEqual({
      moves: [{ unit: unit("JSN"), from: "nest", to: "lodge" }],
      missing: [],
    });
  });

  it("never takes the last ant of a watched place, but empties a place nobody watches", () => {
    const armies = { field: armyFromKeys({ SN: 1 }), nest: armyFromKeys({ Tk: 1 }), lodge: armyFromKeys({}) };
    expect(probeMoves(armies, PLACES)).toEqual({ moves: [], missing: ["lodge"] });
    expect(probeMoves(armies, ["field", "lodge"]).moves).toEqual([{ unit: unit("Tk"), from: "nest", to: "lodge" }]);
  });

  it("takes a dearer unit when the cheapest one is the last ant of its place", () => {
    const armies = { field: armyFromKeys({ JSN: 1 }), nest: armyFromKeys({ S: 3 }), lodge: armyFromKeys({}) };
    expect(probeMoves(armies, PLACES).moves).toEqual([{ unit: unit("S"), from: "nest", to: "lodge" }]);
  });

  it("fills every empty place from one stack, keeping one ant there", () => {
    const armies = { field: armyFromKeys({ JSN: 2 }), nest: armyFromKeys({}), lodge: armyFromKeys({}) };
    expect(probeMoves(armies, PLACES)).toEqual({
      moves: [{ unit: unit("JSN"), from: "field", to: "nest" }],
      missing: ["lodge"],
    });
  });

  it("does nothing when every watched place has its probe", () => {
    const armies = { field: armyFromKeys({ JSN: 1 }), nest: armyFromKeys({ JSN: 1 }), lodge: armyFromKeys({ Tk: 3 }) };
    expect(probeMoves(armies, PLACES)).toEqual({ moves: [], missing: [] });
  });
});

describe("keepProbes", () => {
  it("keeps the cheapest units home, one per probe", () => {
    const home = armyFromKeys({ JSN: 2, SN: 100 });
    expect(keepProbes(home, home, 3)).toEqual(armyFromKeys({ JSN: 0, SN: 99 }));
  });

  it("counts the ants already staying home", () => {
    const home = armyFromKeys({ JSN: 100, Tk: 2 });
    expect(keepProbes(armyFromKeys({ JSN: 100 }), home, 3)).toEqual(armyFromKeys({ JSN: 99 }));
    expect(keepProbes(armyFromKeys({ JSN: 50 }), home, 3)).toEqual(armyFromKeys({ JSN: 50 }));
  });

  it("sends nothing rather than leave fewer probes", () => {
    const home = armyFromKeys({ JSN: 2 });
    expect(keepProbes(home, home, 3)).toEqual(armyFromKeys({}));
  });
});
