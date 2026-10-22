import { describe, expect, it } from "vitest";
import {
  bounds,
  chartHeightFor,
  fittedBounds,
  fittedGrid,
  fittedHeight,
  fittedWindow,
  plotShape,
  squareGrid,
  type MapWindow,
} from "./axes";

describe("map bounds", () => {
  const members = [
    { x: 55, y: 28 },
    { x: 35, y: 8 },
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

describe("map fitted to the server's shape", () => {
  const server = [
    { x: 0, y: 0 },
    { x: 104, y: 3 },
    { x: 50, y: 69 },
  ];

  it("gives each axis its own range, just around every player", () => {
    expect(fittedBounds(server)).toEqual({ x: [-2, 106], y: [-2, 71] });
  });

  it("keeps one scale: the plot area has the shape of the ranges, within the height allowed", () => {
    const axes = fittedBounds(server);
    const aspect = (axes.y[1] - axes.y[0]) / (axes.x[1] - axes.x[0]);
    for (const [width, maxHeight] of [
      [900, 2000],
      [900, 400],
    ] as const) {
      const height = fittedHeight(width, maxHeight, axes);
      expect(height).toBeLessThanOrEqual(maxHeight);
      const grid = fittedGrid(width, height, axes);
      const plot = { width: width - grid.left - grid.right, height: height - grid.top - grid.bottom };
      expect(plot.height / plot.width).toBeCloseTo(aspect);
    }
  });

  it("frames points with the plot's shape, inside the server", () => {
    const full = fittedBounds(server);
    const aspect = (full.y[1] - full.y[0]) / (full.x[1] - full.x[0]);
    const frame = fittedWindow(
      [
        { x: 10, y: 10 },
        { x: 12, y: 30 },
      ],
      full,
    );
    expect((frame.y[1] - frame.y[0]) / (frame.x[1] - frame.x[0])).toBeCloseTo(aspect);
    expect(frame.x[0]).toBeGreaterThanOrEqual(full.x[0]);
    expect(frame.y[0]).toBeLessThanOrEqual(8);
    expect(frame.y[1]).toBeGreaterThanOrEqual(32);
    // Near an edge, the window slides back inside rather than past it.
    expect(fittedWindow([{ x: 105, y: 70 }], full).x[1]).toBe(106);
    // Wider than the server: the whole server.
    expect(
      fittedWindow(
        [
          { x: -2, y: 0 },
          { x: 106, y: 0 },
        ],
        full,
      ),
    ).toEqual({ x: full.x, y: full.y });
  });
});

describe("a very tall server (S4: 50 × 2 058 squares)", () => {
  const full: MapWindow = { x: [-4, 50], y: [-2, 2060] };

  it("plots a band at most 1.5 times taller than wide, the axes still holding the whole server", () => {
    expect(plotShape(full)).toEqual({ x: [-4, 50], y: [-2, 79] });
    expect(plotShape({ x: [0, 100], y: [0, 74] })).toEqual({ x: [0, 100], y: [0, 74] });
    const grid = fittedGrid(400, fittedHeight(400, 720, full), full);
    expect((fittedHeight(400, 720, full) - grid.top - grid.bottom) / (400 - grid.left - grid.right)).toBeCloseTo(1.5);
  });

  it("opens on a band around the players, never on the whole needle", () => {
    const window = fittedWindow(
      [
        { x: 0, y: 1000 },
        { x: 40, y: 1010 },
      ],
      full,
    );
    expect(window.x).toEqual([-2, 42]);
    expect(window.y[1] - window.y[0]).toBeCloseTo(66);
    expect(window.y[0]).toBeLessThan(1000);
    expect(window.y[1]).toBeGreaterThan(1010);
  });
});

describe("a server of 216 000 players", () => {
  it("is measured without overflowing the stack", () => {
    const players = Array.from({ length: 216_654 }, (_, i) => ({ x: i % 50, y: Math.floor(i / 105) }));
    expect(fittedBounds(players)).toEqual({ x: [-2, 51], y: [-2, 2065] });
    expect(fittedWindow(players, fittedBounds(players)).x).toEqual([-2, 51]);
  });
});
