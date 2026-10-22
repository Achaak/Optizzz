import { describe, expect, it } from "vitest";
import { columnDay, dayColumn, missingDays } from "./days";

describe("missingDays", () => {
  const now = new Date("2026-10-22T09:30:00Z");
  // 22:00 UTC is midnight in Paris (summer time): each day's first export.
  const versions = ["202610220800", "202610212200", "202610211500", "202610202200", "202610192200"];

  it("gives the first export of each day not stored yet, oldest first", () => {
    expect(missingDays(versions, new Set(["2026-10-21"]), now, 10)).toEqual([
      { day: "2026-10-20", version: "202610192200" },
      { day: "2026-10-22", version: "202610212200" },
    ]);
  });

  it("takes at most `limit` days", () => {
    expect(missingDays(versions, new Set(), now, 1)).toEqual([{ day: "2026-10-20", version: "202610192200" }]);
  });
});

describe("dayColumn", () => {
  it("keeps the Paris day as it is", () => {
    expect(columnDay(dayColumn("2026-10-25"))).toBe("2026-10-25");
  });
});
