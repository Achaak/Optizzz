import { describe, expect, it } from "vitest";
import { bounds, chartHeightFor, squareGrid } from "./chart-option";

describe("map bounds", () => {
  const members = [
    { x: 95, y: 48 },
    { x: 75, y: 28 },
    { x: 30, y: 0 },
    { x: 110, y: 60 },
  ];

  it("gives both axes the same range, on round ticks, around every player", () => {
    const { x, y, step } = bounds(members);
    expect(x[1] - x[0]).toBe(y[1] - y[0]);
    for (const value of [...x, ...y]) expect(Math.abs(value % step)).toBe(0);
    for (const m of members) {
      expect(m.x).toBeGreaterThan(x[0]);
      expect(m.x).toBeLessThan(x[1]);
      expect(m.y).toBeGreaterThan(y[0]);
      expect(m.y).toBeLessThan(y[1]);
    }
  });

  it("never goes far below 0, coordinates are never negative", () => {
    const { y, step } = bounds(members);
    expect(y[0]).toBe(-step);
    expect(
      bounds([
        { x: 40, y: 40 },
        { x: 50, y: 45 },
      ]).y[0],
    ).toBeGreaterThanOrEqual(0);
  });
});

describe("square plot", () => {
  it("leaves a plot area as wide as it is high", () => {
    for (const width of [400, 900, 1400]) {
      const height = chartHeightFor(width, 640);
      const grid = squareGrid(width, height);
      expect(width - grid.left - grid.right).toBeCloseTo(height - grid.top - grid.bottom);
    }
  });
});
