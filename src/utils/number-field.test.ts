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

  it("refuses an empty or unreadable field unless empty is allowed", () => {
    expect(parseNumberField("")).toBeUndefined();
    expect(parseNumberField("abc")).toBeUndefined();
    expect(parseNumberField("", { allowEmpty: true })).toBeNull();
  });
});
