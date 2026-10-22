import { describe, expect, it } from "vitest";
import { colonyTaxRate, estimateProduction } from "./production";

describe("colonyTaxRate", () => {
  it("is 20 % plus 1 % per level of the master's aphid stable", () => {
    expect(colonyTaxRate(0)).toBeCloseTo(0.2);
    expect(colonyTaxRate(13)).toBeCloseTo(0.33);
  });
});

describe("estimateProduction", () => {
  it("puts one worker on each cm², each bringing 48 a day", () => {
    expect(estimateProduction(1_206_299, 0)).toEqual({ gross: 57_902_352, tax: 0, net: 57_902_352 });
  });

  it("takes the colony tax off, rounded down as the game does", () => {
    // floor(0.33 × 57 902 352) = 19 107 776
    expect(estimateProduction(1_206_299, 0.33)).toEqual({ gross: 57_902_352, tax: 19_107_776, net: 38_794_576 });
  });
});
