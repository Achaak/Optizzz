import { describe, expect, it } from "vitest";
import { dailyCounts, discordAlerts } from "./overview";

describe("dailyCounts", () => {
  it("counts per Paris day, empty days included, today last", () => {
    const now = new Date("2026-11-02T13:00:00Z");
    const dates = [
      new Date("2026-11-02T08:00:00Z"),
      new Date("2026-11-01T23:30:00Z"), // 0 h 30 in Paris, the 2nd
      new Date("2026-10-31T10:00:00Z"),
      new Date("2026-10-20T10:00:00Z"), // too old
    ];
    expect(dailyCounts(dates, now, 3)).toEqual([
      { label: "31/10", value: 1 },
      { label: "01/11", value: 0 },
      { label: "02/11", value: 2 },
    ]);
  });

  it("gives each day once across the change to winter time", () => {
    const labels = dailyCounts([], new Date("2026-10-26T23:30:00Z"), 4).map((d) => d.label);
    expect(labels).toEqual(["24/10", "25/10", "26/10", "27/10"]);
  });
});

describe("discordAlerts", () => {
  it("names a refused webhook and suspended reminders, and nothing else", () => {
    expect(
      discordAlerts([
        { space: "4O4", server: "S5", refusedStatus: 404, suspendedStatus: 401 },
        { space: "LGA", server: "S2", refusedStatus: null, suspendedStatus: null },
      ]),
    ).toEqual([
      { topic: "discord", text: "4O4 (S5) : Discord refuse les annonces (404)." },
      { topic: "discord", text: "4O4 (S5) : rappels suspendus, Discord a refusé le webhook (401)." },
    ]);
  });
});
