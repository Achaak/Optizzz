import { describe, expect, it } from "vitest";
import { sparklinePath } from "./sparkline";

describe("sparklinePath", () => {
  it("runs from the lowest value at the bottom to the highest at the top", () => {
    expect(sparklinePath([0, 5, 10], 100, 20, 0)).toBe("M0 20 L50 10 L100 0");
  });

  it("keeps a margin above and below", () => {
    expect(sparklinePath([0, 10], 100, 20, 2)).toBe("M0 18 L100 2");
  });

  it("draws equal values as a flat line in the middle", () => {
    expect(sparklinePath([7, 7], 100, 20)).toBe("M0 10 L100 10");
  });

  it("draws nothing without values", () => {
    expect(sparklinePath([], 100, 20)).toBe("");
  });
});
