import { describe, expect, it } from "vitest";
import { parseNumberField } from "./number-field";

describe("parseNumberField", () => {
  it("reads a number", () => {
    expect(parseNumberField("150")).toBe(150);
    expect(parseNumberField(" 1,5 ")).toBe(1.5);
  });

  it("clamps to the bounds", () => {
    expect(parseNumberField("0", { min: 0.1 })).toBe(0.1);
    expect(parseNumberField("99", { max: 20 })).toBe(20);
  });

  it("rounds down whole numbers", () => {
    expect(parseNumberField("12.8", { integer: true })).toBe(12);
  });

  it("reads an amount as the game writes it, or shortened", () => {
    const amount = { amount: true };
    expect(parseNumberField("10 000", amount)).toBe(10_000);
    expect(parseNumberField("12\u202f348", amount)).toBe(12_348);
    expect(parseNumberField("10k", amount)).toBe(10_000);
    expect(parseNumberField("1,5 M", amount)).toBe(1_500_000);
    expect(parseNumberField("2m", amount)).toBe(2_000_000);
    expect(parseNumberField("10 k 5", amount)).toBeUndefined();
    expect(parseNumberField("10 000")).toBeUndefined();
  });

  it("refuses an empty or unreadable field unless empty is allowed", () => {
    expect(parseNumberField("")).toBeUndefined();
    expect(parseNumberField("abc")).toBeUndefined();
    expect(parseNumberField("", { allowEmpty: true })).toBeNull();
  });
});
