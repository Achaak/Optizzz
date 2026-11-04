import { describe, expect, it } from "vitest";
import { readRange, resolvePeriod } from "./period";

// Wednesday 4 November 2026, 14 h 00 in Paris (UTC+1).
const NOW = new Date("2026-11-04T13:00:00Z");

describe("a period of the statistics", () => {
  it("counts the last days back from now, today included", () => {
    expect(resolvePeriod({ days: 7 }, NOW, 90)).toEqual({
      days: 7,
      end: NOW,
      range: null,
      first: "2026-10-29",
    });
  });

  it("runs from a Paris day to another, both included, a past one up to its last millisecond", () => {
    const period = resolvePeriod({ from: "2026-10-12", to: "2026-10-20" }, NOW, 90);
    expect(period.days).toBe(9);
    // 21/10 at midnight in Paris (UTC+2 before the end of October), less a millisecond.
    expect(period.end).toEqual(new Date(new Date("2026-10-20T22:00:00Z").getTime() - 1));
    expect(period.range).toEqual({ from: "2026-10-12", to: "2026-10-20" });
  });

  it("stops a period ending today at now", () => {
    const period = resolvePeriod({ from: "2026-11-02", to: "2026-11-04" }, NOW, 90);
    expect(period.days).toBe(3);
    expect(period.end).toEqual(NOW);
  });

  it("keeps a free period within what the site keeps and puts its days in order", () => {
    expect(resolvePeriod({ from: "2026-11-10", to: "2026-05-01" }, NOW, 90).range).toEqual({
      from: "2026-08-07",
      to: "2026-11-04",
    });
    expect(resolvePeriod({ from: "2026-11-03", to: "2026-10-01" }, NOW, 7).range).toEqual({
      from: "2026-10-29",
      to: "2026-11-03",
    });
  });
});

describe("a free period in the address", () => {
  it("reads two days, from and to", () => {
    const params = new URLSearchParams("du=2026-10-12&au=2026-10-20");
    expect(readRange(params)).toEqual({ from: "2026-10-12", to: "2026-10-20" });
  });

  it("ignores a day missing or not a day", () => {
    expect(readRange(new URLSearchParams("du=2026-10-12"))).toBeNull();
    expect(readRange(new URLSearchParams("du=2026-10-12&au=demain"))).toBeNull();
    expect(readRange(new URLSearchParams("du=2026-13-40&au=2026-10-20"))).toBeNull();
    expect(readRange(new URLSearchParams("du=2026-02-30&au=2026-10-20"))).toBeNull();
  });
});
