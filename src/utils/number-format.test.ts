import { describe, expect, it } from "vitest";
import { formatDecimal, formatNumber } from "./number-format";

describe("formatNumber", () => {
  it("separates thousands with a space, like the game", () => {
    expect(formatNumber(1234567)).toBe("1 234 567");
    expect(formatNumber(12.6)).toBe("13");
  });
});

describe("formatDecimal", () => {
  it("writes decimals with a comma and drops useless zeros", () => {
    expect(formatDecimal(18.44)).toBe("18,4");
    expect(formatDecimal(3)).toBe("3");
    expect(formatDecimal(2.96)).toBe("3");
    expect(formatDecimal(12348.25, 2)).toBe("12 348,25");
    expect(formatDecimal(-1.25)).toBe("-1,3");
    expect(formatDecimal(-0.01)).toBe("0");
  });
});
