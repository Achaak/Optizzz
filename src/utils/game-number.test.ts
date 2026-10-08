import { describe, expect, it } from "vitest";
import { parseGameInteger } from "./game-number";

describe("parseGameInteger", () => {
  it("reads the game's numbers, separators and words around dropped", () => {
    expect(parseGameInteger("12 348")).toBe(12348);
    expect(parseGameInteger("1 199 cm²")).toBe(1199);
    expect(parseGameInteger("niveau 7")).toBe(7);
  });

  it("keeps a leading minus, not a list dash", () => {
    expect(parseGameInteger("−2 397")).toBe(-2397);
    expect(parseGameInteger("-15")).toBe(-15);
    expect(parseGameInteger("- Champignonnière 9")).toBe(9);
  });

  it("is 0 without any digit", () => {
    expect(parseGameInteger("")).toBe(0);
    expect(parseGameInteger(undefined)).toBe(0);
    expect(parseGameInteger("aucune")).toBe(0);
  });
});
