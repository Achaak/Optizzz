import { afterEach, describe, expect, it } from "vitest";
import {
  formatAmount,
  formatCompact,
  formatDecimal,
  formatNumber,
  isCompacted,
  setCompactNumbers,
  showExactAmount,
} from "./number-format";

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

describe("formatCompact", () => {
  it("keeps numbers under 10 000 whole", () => {
    expect(formatCompact(9999)).toBe("9 999");
    expect(formatCompact(1234.4)).toBe("1 234");
    expect(formatCompact(0)).toBe("0");
  });

  it("keeps three significant digits with K, M and G", () => {
    expect(formatCompact(12345)).toBe("12,3K");
    expect(formatCompact(123456)).toBe("123K");
    expect(formatCompact(1234567)).toBe("1,23M");
    expect(formatCompact(4512345678)).toBe("4,51G");
  });

  it("drops useless zeros", () => {
    expect(formatCompact(10000)).toBe("10K");
    expect(formatCompact(12000)).toBe("12K");
    expect(formatCompact(1500000)).toBe("1,5M");
  });

  it("moves to the next unit when rounding reaches 1 000", () => {
    expect(formatCompact(999999)).toBe("1M");
    expect(formatCompact(999499)).toBe("999K");
    expect(formatCompact(99960)).toBe("100K");
  });

  it("keeps the sign", () => {
    expect(formatCompact(-12345)).toBe("-12,3K");
    expect(formatCompact(-5)).toBe("-5");
  });
});

describe("formatAmount", () => {
  afterEach(() => setCompactNumbers(false));

  it("writes the exact number until compact numbers are switched on", () => {
    expect(formatAmount(1234567)).toBe("1 234 567");
    setCompactNumbers(true);
    expect(formatAmount(1234567)).toBe("1,23M");
    expect(formatAmount(9999)).toBe("9 999");
  });

  it("tells whether the number was shortened", () => {
    setCompactNumbers(true);
    expect(isCompacted(12345)).toBe(true);
    expect(isCompacted(9999)).toBe(false);
    setCompactNumbers(false);
    expect(isCompacted(12345)).toBe(false);
  });
});

describe("showExactAmount", () => {
  afterEach(() => setCompactNumbers(false));

  it("puts the exact number on hover only when it is shortened", () => {
    const cell = document.createElement("td");
    showExactAmount(cell, 9999);
    expect(cell.title).toBe("");
    setCompactNumbers(true);
    showExactAmount(cell, 1234567);
    expect(cell.title).toBe("1 234 567");
  });
});
