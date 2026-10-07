import { describe, expect, it } from "vitest";
import { parseCounts, unitKeyOf } from "./units";

describe("parseCounts", () => {
  it("reads counts written with thousands separators, names as written", () => {
    expect(parseCounts("1 921 Jeunes Soldates Naines, 119 Soldates Naines.")).toEqual([
      ["Jeunes Soldates Naines", 1921],
      ["Soldates Naines", 119],
    ]);
    expect(parseCounts("1 Tank")).toEqual([["Tank", 1]]);
  });
});

describe("unitKeyOf", () => {
  it("knows singular, plural, abbreviation and either apostrophe", () => {
    expect(unitKeyOf("Tank")).toBe("Tk");
    expect(unitKeyOf("Naines d'Elite")).toBe("NE");
    expect(unitKeyOf("jsn")).toBe("JSN");
    expect(unitKeyOf("Fourmi volante")).toBeUndefined();
  });
});
