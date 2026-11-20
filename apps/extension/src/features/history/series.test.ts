import { describe, expect, it } from "vitest";
import type { Snapshot } from "./api";
import { averageSeries, periodProgress, periodRanks, playerSeries, rankText } from "./series";

const scores = (field: number) => ({ field, building: 30, technology: 15, trophy: 0 });

const history: Snapshot[] = (
  [
    { version: "202610052200", players: new Map([[1, scores(100)]]) },
    { version: "202610062200", players: new Map([[2, scores(70)]]) },
    {
      version: "202610072200",
      players: new Map([
        [1, scores(150)],
        [2, scores(80)],
      ]),
    },
  ] satisfies Omit<Snapshot, "alliances">[]
).map((snapshot) => ({ ...snapshot, alliances: new Map() }));

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

describe("periodRanks", () => {
  /** Four nights where each player goes linearly from `start` to `end`. */
  const nights = (players: readonly { id: number; start: number; end: number }[]): Snapshot[] =>
    [0, 1, 2, 3].map((night) => ({
      version: `2026101${String(night)}2200`,
      players: new Map(
        players.map(({ id, start, end }) => [id, scores(Math.round(start + ((end - start) * night) / 3))]),
      ),
      alliances: new Map(),
    }));

  it("ranks each member against the players of its size who still play, over the period", () => {
    const history = nights([
      // +10 %.
      { id: 1, start: 1000, end: 1100 },
      // 12 peers from +0,5 % to +11,5 %: it beats the ten up to +9,5 %.
      ...Array.from({ length: 12 }, (_, i) => ({ id: i + 2, start: 1000, end: 1005 + i * 10 })),
      // Nothing moved for 3 nights: probably inactive, left out.
      { id: 50, start: 1000, end: 1000 },
      // On holiday or banned in the last export: left out.
      { id: 51, start: 1000, end: 2000 },
    ]);
    expect(periodRanks(history, [1], new Set([51])).get(1)).toEqual({ faster: 10, peers: 12 });
  });
});

describe("rankText", () => {
  it("says how many players of its size it grew faster than, in %", () => {
    expect(rankText({ faster: 171, peers: 214 })).toBe(
      "Progresse plus vite que 80 % des 214 joueurs de sa taille sur la période.",
    );
  });
});
