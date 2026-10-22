import { describe, expect, it } from "vitest";
import { assignColors, comparedColors, colorsToStore } from "./colors";

describe("assignColors", () => {
  const palette = ["red", "blue", "gold"];

  it("gives the palette in order", () => {
    expect([...assignColors(["A", "B"], new Map(), palette)]).toEqual([
      ["A", "red"],
      ["B", "blue"],
    ]);
  });

  it("keeps an alliance's colour when another one goes", () => {
    const before = assignColors(["A", "B", "C"], new Map(), palette);
    expect(assignColors(["A", "C"], before, palette).get("C")).toBe("gold");
  });

  it("gives a newcomer the first colour left", () => {
    const before = new Map([
      ["A", "red"],
      ["C", "gold"],
    ]);
    expect(assignColors(["A", "C", "D"], before, palette).get("D")).toBe("blue");
  });

  it("ignores the case of the tags", () => {
    expect(assignColors(["abc"], new Map([["ABC", "gold"]]), palette).get("abc")).toBe("gold");
  });
});

describe("comparedColors", () => {
  const palette = ["red", "blue", "gold", "green"];

  it("keeps the first colour for mine, the others from the next ones", () => {
    expect([...comparedColors("MOI", ["A", "B"], {}, palette)]).toEqual([
      ["MOI", "red"],
      ["A", "blue"],
      ["B", "gold"],
    ]);
  });

  it("gives each compared alliance its remembered colour, whatever its place in the list", () => {
    const colors = comparedColors("MOI", ["B", "A"], { A: "blue", B: "green" }, palette);
    expect(colors.get("A")).toBe("blue");
    expect(colors.get("B")).toBe("green");
  });

  it("never gives the colour of mine to another, even without an alliance", () => {
    expect(comparedColors(null, ["A"], { A: "red" }, palette).get("A")).toBe("blue");
  });
});

describe("colorsToStore", () => {
  it("keeps the compared alliances only, as their tag is written in the list", () => {
    const colors = new Map([
      ["MOI", "red"],
      ["A", "blue"],
    ]);
    expect(colorsToStore(["A", "B"], colors)).toEqual({ A: "blue" });
  });
});
