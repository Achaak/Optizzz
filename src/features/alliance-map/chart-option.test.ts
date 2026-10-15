import { describe, expect, it } from "vitest";
import { bounds, buildChartOption, chartHeightFor, squareGrid, type MapMember } from "./chart-option";
import type { KnownLevels } from "./neighbor-table";

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

describe("chain roles on the map", () => {
  const member = (id: number, x: number): MapMember => ({
    id,
    pseudo: `P${String(id)}`,
    x,
    y: 10,
    alliance: "TAG",
    field: 1000,
    huntingField: 1000,
    grade: null,
    buildingScore: 0,
    technologyScore: 0,
    trophyScore: 0,
    onHoliday: false,
    isBanned: false,
    masterPlayerId: null,
  });
  const me = member(1, 10);
  const members = [me, member(2, 30)];
  const levels: KnownLevels = {
    myId: 1,
    labLevel: 0,
    manualLevel: null,
    byPlayer: new Map(),
    enteredAt: new Map(),
    shared: new Map(),
  };
  const nodes = (option: ReturnType<typeof buildChartOption>) =>
    (option.series as { data: { symbolSize: number; itemStyle: { color: string; borderWidth?: number } }[] }[])[0]
      ?.data ?? [];

  it("draws each member with its role's colour and size, the selected one ringed and a little bigger", () => {
    const bubbles = new Map([
      [1, { role: { kind: "granary" } as const, color: "#111111", px: 17 }],
      [2, { role: { kind: "hunter" } as const, color: "#222222", px: 8 }],
    ]);
    const [selected, other] = nodes(buildChartOption(members, me, 1, levels, { width: 500, height: 500 }, bubbles));
    expect(other).toMatchObject({ symbolSize: 8, itemStyle: { color: "#222222", borderWidth: 0 } });
    expect(selected?.itemStyle.color).toBe("#111111");
    expect(selected?.symbolSize).toBeGreaterThan(17);
    expect(selected?.itemStyle.borderWidth).toBeGreaterThan(0);
  });
});
