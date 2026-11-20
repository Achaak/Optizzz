import { describe, expect, it } from "vitest";
import { activityGrid, quietHours } from "./activity";

/** A change between two exports an hour apart, from `since` (UTC). */
const change = (since: string, delta: number, hours = 1) => ({
  since: new Date(since),
  at: new Date(new Date(since).getTime() + hours * 3_600_000),
  delta,
});

describe("activityGrid", () => {
  it("counts the rises and the falls by Paris weekday and hour, Monday first", () => {
    const grid = activityGrid([
      // Monday 16 November, 12:00 UTC: 13 h in Paris (winter time).
      change("2026-11-16T12:00:00Z", 100),
      change("2026-11-23T12:00:00Z", 50),
      // Tuesday 17 November, 01:00 UTC: 2 h in Paris.
      change("2026-11-17T01:00:00Z", -300),
      // Three hours between the two exports: when it moved is unknown.
      change("2026-11-18T10:00:00Z", 100, 3),
    ]);
    expect(grid.rises[0]?.[13]).toBe(2);
    expect(grid.falls[1]?.[2]).toBe(1);
    expect(grid.rises.flat().reduce((a, b) => a + b)).toBe(2);
    expect(grid.falls.flat().reduce((a, b) => a + b)).toBe(1);
  });
});

describe("quietHours", () => {
  /** A rise each day from 2026-10-26 (28 days, winter time) at each of the Paris `hours`. */
  const everyDay = (hours: number[]) =>
    Array.from({ length: 28 }, (_, day) =>
      hours.map((hour) => change(new Date(Date.UTC(2026, 9, 26 + day, hour - 1)).toISOString(), 10)),
    ).flat();
  const active = [0, 1, ...Array.from({ length: 15 }, (_, i) => i + 9)];

  it("finds the longest run of hours without a rise on at least 3 days out of 4", () => {
    expect(quietHours(everyDay(active), 28)).toEqual({ from: 2, to: 9 });
  });

  it("lets a rare rise in the run pass, but not a frequent one", () => {
    // At 4 h on 7 days of 28: a quarter, still quiet.
    const rare = [...everyDay(active), ...everyDay([4]).slice(0, 7)];
    expect(quietHours(rare, 28)).toEqual({ from: 2, to: 9 });
    // On 8 days: no longer quiet, the longest run is now 5 h – 9 h.
    const frequent = [...everyDay(active), ...everyDay([4]).slice(0, 8)];
    expect(quietHours(frequent, 28)).toEqual({ from: 5, to: 9 });
  });

  it("has no quiet hours when nothing rose at all, nor under 3 hours in a row", () => {
    expect(quietHours([], 28)).toBeNull();
    const busy = Array.from({ length: 24 }, (_, hour) => hour).filter((hour) => hour !== 3 && hour !== 4);
    expect(quietHours(everyDay(busy), 28)).toBeNull();
  });
});
