import { describe, expect, it } from "vitest";
import { distance, travelTime } from "./travel";

describe("travelTime", () => {
  // Reference values computed separately with the Toolzzz formula:
  // ceil(0.9^level × 637200 × (1 − e^(−d/350))).
  it("returns the time in seconds without speed bonus", () => {
    expect(travelTime(10, 0)).toBe(17949);
  });

  it("reduces the time with the Attack Speed level", () => {
    expect(travelTime(10, 3)).toBe(13085);
  });

  it("is 0 on the spot", () => {
    expect(travelTime(0, 0)).toBe(0);
  });
});

describe("distance", () => {
  it("is the straight line between two squares", () => {
    expect(distance({ x: 95, y: 48 }, { x: 94, y: 51 })).toBeCloseTo(3.162, 3);
  });
});
