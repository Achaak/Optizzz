import { describe, expect, it } from "vitest";
import type { Snapshot } from "./api";
import { averageSeries, periodProgress, playerSeries } from "./series";

const scores = (field: number) => ({ field, building: 30, technology: 15, trophy: 0 });

const history: Snapshot[] = [
  { version: "202610052200", players: new Map([[1, scores(100)]]) },
  { version: "202610062200", players: new Map([[2, scores(70)]]) },
  {
    version: "202610072200",
    players: new Map([
      [1, scores(150)],
      [2, scores(80)],
    ]),
  },
];

const now = new Date("2026-10-08T09:30:00Z");

describe("playerSeries", () => {
  it("gives the player's value at each export where they exist", () => {
    expect(playerSeries(history, 1, "field")).toEqual([
      { time: Date.parse("2026-10-05T22:00:00Z"), value: 100, live: false },
      { time: Date.parse("2026-10-07T22:00:00Z"), value: 150, live: false },
    ]);
  });

  it("ends on the live value read in the game", () => {
    const series = playerSeries(history, 1, "field", { time: now, scores: { field: 180 } });
    expect(series.at(-1)).toEqual({ time: now.getTime(), value: 180, live: true });
  });

  it("has no live point for a score the page does not show", () => {
    const series = playerSeries(history, 1, "trophy", { time: now, scores: { field: 180 } });
    expect(series.every((point) => !point.live)).toBe(true);
  });
});

describe("periodProgress", () => {
  it("compares the last value with the first", () => {
    const series = playerSeries(history, 1, "field", { time: now, scores: { field: 180 } });
    expect(periodProgress(series)).toEqual({ first: 100, last: 180, gain: 80, percent: 80 });
  });

  it("has no percentage from zero", () => {
    const series = [
      { time: 1, value: 0, live: false },
      { time: 2, value: 3, live: false },
    ];
    expect(periodProgress(series)).toEqual({ first: 0, last: 3, gain: 3, percent: null });
  });

  it("is unknown without any value", () => {
    expect(periodProgress([])).toBeNull();
  });
});

describe("averageSeries", () => {
  it("averages the players present at each export, then their live values", () => {
    const live = {
      time: now,
      scores: new Map([
        [1, { field: 200 }],
        [2, { field: 100 }],
      ]),
    };
    expect(averageSeries(history, [1, 2], "field", live)).toEqual([
      { time: Date.parse("2026-10-05T22:00:00Z"), value: 100, live: false },
      { time: Date.parse("2026-10-06T22:00:00Z"), value: 70, live: false },
      { time: Date.parse("2026-10-07T22:00:00Z"), value: 115, live: false },
      { time: now.getTime(), value: 150, live: true },
    ]);
  });
});
