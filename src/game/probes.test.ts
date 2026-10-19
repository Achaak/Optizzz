import { describe, expect, it } from "vitest";
import { armyFromKeys, UNITS } from "./army/units";
import { keepProbes, placesWithoutProbe, probeArmy, probeMoves, type ProbePlan } from "./probes";

const unit = (key: string) => UNITS.findIndex((candidate) => candidate.key === key);

const oneJsn = armyFromKeys({ JSN: 1 });
const everywhere: ProbePlan = { field: oneJsn, nest: oneJsn, lodge: oneJsn };

describe("placesWithoutProbe", () => {
  it("lists the watched places short of a unit of their plan", () => {
    const armies = { field: armyFromKeys({ JSN: 10 }), nest: armyFromKeys({ Tk: 5 }), lodge: armyFromKeys({}) };
    expect(placesWithoutProbe(armies, everywhere)).toEqual(["nest", "lodge"]);
    expect(placesWithoutProbe(armies, { field: armyFromKeys({ JSN: 10 }), lodge: armyFromKeys({}) })).toEqual([]);
    expect(placesWithoutProbe(armies, { field: armyFromKeys({ JSN: 11 }) })).toEqual(["field"]);
  });
});

describe("probeArmy", () => {
  it("adds up the probes of every watched place", () => {
    expect(probeArmy({ nest: armyFromKeys({ JSN: 10, SN: 2 }), lodge: armyFromKeys({ JSN: 5 }) })).toEqual(
      armyFromKeys({ JSN: 15, SN: 2 }),
    );
  });
});

describe("probeMoves", () => {
  it("moves the ants wanted from where there are the most to spare", () => {
    const armies = {
      field: armyFromKeys({ JSN: 5, Tk: 40 }),
      nest: armyFromKeys({ JSN: 900 }),
      lodge: armyFromKeys({}),
    };
    expect(probeMoves(armies, { lodge: armyFromKeys({ JSN: 100 }) })).toEqual({
      moves: [{ unit: unit("JSN"), count: 100, from: "nest", to: "lodge" }],
      missing: [],
    });
  });

  it("brings each unit of the plan, taking from several places when one is not enough", () => {
    const armies = {
      field: armyFromKeys({ JSN: 30, SN: 10 }),
      nest: armyFromKeys({ JSN: 20 }),
      lodge: armyFromKeys({ JSN: 5 }),
    };
    expect(probeMoves(armies, { lodge: armyFromKeys({ JSN: 50, SN: 2 }) })).toEqual({
      moves: [
        { unit: unit("JSN"), count: 30, from: "field", to: "lodge" },
        { unit: unit("JSN"), count: 15, from: "nest", to: "lodge" },
        { unit: unit("SN"), count: 2, from: "field", to: "lodge" },
      ],
      missing: [],
    });
  });

  it("never takes the probes of another watched place, but empties a place nobody watches", () => {
    const armies = { field: armyFromKeys({ JSN: 3 }), nest: armyFromKeys({ JSN: 3 }), lodge: armyFromKeys({}) };
    const plan = { field: armyFromKeys({ JSN: 3 }), nest: armyFromKeys({ JSN: 3 }), lodge: armyFromKeys({ JSN: 1 }) };
    expect(probeMoves(armies, plan)).toEqual({ moves: [], missing: ["lodge"] });
    expect(probeMoves(armies, { nest: plan.nest, lodge: plan.lodge }).moves).toEqual([
      { unit: unit("JSN"), count: 1, from: "field", to: "lodge" },
    ]);
  });

  it("moves what it can and says where ants are still missing", () => {
    const armies = { field: armyFromKeys({ JSN: 2 }), nest: armyFromKeys({}), lodge: armyFromKeys({}) };
    expect(probeMoves(armies, { field: armyFromKeys({}), nest: oneJsn, lodge: armyFromKeys({ JSN: 5 }) })).toEqual({
      moves: [
        { unit: unit("JSN"), count: 1, from: "field", to: "nest" },
        { unit: unit("JSN"), count: 1, from: "field", to: "lodge" },
      ],
      missing: ["lodge"],
    });
  });

  it("does nothing when every watched place has its probes", () => {
    const armies = { field: armyFromKeys({ JSN: 1 }), nest: armyFromKeys({ JSN: 1 }), lodge: armyFromKeys({ JSN: 3 }) };
    expect(probeMoves(armies, everywhere)).toEqual({ moves: [], missing: [] });
  });
});

describe("keepProbes", () => {
  it("keeps the probes home, unit by unit", () => {
    const home = armyFromKeys({ JSN: 200, SN: 100 });
    const plan = { nest: armyFromKeys({ JSN: 10 }), lodge: armyFromKeys({ JSN: 5, SN: 1 }) };
    expect(keepProbes(home, home, plan)).toEqual(armyFromKeys({ JSN: 185, SN: 99 }));
  });

  it("counts the ants already staying home", () => {
    const home = armyFromKeys({ JSN: 100, Tk: 2 });
    const plan = { lodge: armyFromKeys({ JSN: 3 }) };
    expect(keepProbes(armyFromKeys({ JSN: 99 }), home, plan)).toEqual(armyFromKeys({ JSN: 97 }));
    expect(keepProbes(armyFromKeys({ JSN: 50 }), home, plan)).toEqual(armyFromKeys({ JSN: 50 }));
  });

  it("sends none of a unit rather than leave fewer probes", () => {
    const home = armyFromKeys({ JSN: 2 });
    expect(keepProbes(home, home, everywhere)).toEqual(armyFromKeys({}));
  });
});
