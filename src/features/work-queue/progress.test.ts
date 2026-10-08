import { describe, expect, it } from "vitest";
import { progressOf } from "./progress";
import type { WorkItem } from "@/game/pages/work-queue";

const MINUTE = 60_000;
const now = new Date(2026, 9, 7, 12, 0);
const at = (minutesFromNow: number) => new Date(now.getTime() + minutesFromNow * MINUTE);

const item = (endsInMinutes: number, nextLevelMinutes: number | null): WorkItem => ({
  name: "Champignonnière",
  targetLevel: 9,
  endsAt: at(endsInMinutes),
  cancelHref: null,
  nextLevelDuration: nextLevelMinutes === null ? null : nextLevelMinutes * MINUTE,
});

describe("progressOf", () => {
  it("derives a running building's duration from the next level's (×1.6 per level)", () => {
    // Next level 160 min → this level 100 min, ending in 25 min: started 75 min ago.
    expect(progressOf(item(25, 160), null, "construction", now)).toEqual({
      startsAt: at(-75),
      progress: 0.75,
    });
  });

  it("uses ×1.7 per level for research", () => {
    // Next level 170 min → this level 100 min, ending in 50 min.
    expect(progressOf(item(50, 170), null, "research", now)?.progress).toBeCloseTo(0.5);
  });

  it("keeps the bar between 0 and 1 when the estimate is off", () => {
    expect(progressOf(item(200, 160), null, "construction", now)?.progress).toBe(0);
    expect(progressOf(item(-5, 160), null, "construction", now)?.progress).toBe(1);
  });

  it("starts a queued item when the previous one ends, at 0 %", () => {
    expect(progressOf(item(130, 160), at(30), "construction", now)).toEqual({
      startsAt: at(30),
      progress: 0,
    });
  });

  it("has no progress when the row duration is unknown", () => {
    expect(progressOf(item(25, null), null, "construction", now)).toBeNull();
  });

  it("goes back one level per later item of the same building, whose level the row already shows", () => {
    // Row: level 11 (256 min); 8 → 9 is followed by 9 → 10: 256 / 1.6² = 100 min, ending in 25 min.
    expect(progressOf(item(25, 256), null, "construction", now, 1)?.progress).toBeCloseTo(0.75);
  });

  it("moves a queued item on once the one before it has ended, the page left open", () => {
    // Started 30 min ago, ends in 30 min.
    expect(progressOf(item(30, 160), at(-30), "construction", now)?.progress).toBeCloseTo(0.5);
  });
});
