import { describe, expect, it } from "vitest";
import { dailyVersions, versionDate } from "./versions";

describe("versionDate", () => {
  it("reads the UTC date of a version", () => {
    expect(versionDate("202610062200").toISOString()).toBe("2026-10-06T22:00:00.000Z");
  });
});

describe("dailyVersions", () => {
  const now = new Date("2026-10-08T09:30:00Z");

  it("keeps the first version of each Paris day, oldest first", () => {
    // 22:00 UTC is midnight in Paris (summer time): it opens the next Paris day.
    const versions = ["202610080801", "202610080000", "202610072200", "202610072100", "202610062200", "202610052200"];
    expect(dailyVersions(versions, 30, now)).toEqual(["202610052200", "202610062200", "202610072200"]);
  });

  it("follows the winter time change", () => {
    // 2026-10-25: Paris goes back to UTC+1, so midnight is 23:00 UTC.
    const versions = ["202610262300", "202610262200", "202610252300", "202610252200"];
    expect(dailyVersions(versions, 30, new Date("2026-10-27T09:00:00Z"))).toEqual([
      "202610252200",
      "202610252300",
      "202610262300",
    ]);
  });

  it("only keeps the days of the period", () => {
    const versions = ["202610072200", "202610062200", "202610052200", "202610012200"];
    expect(dailyVersions(versions, 3, now)).toEqual(["202610052200", "202610062200", "202610072200"]);
  });

  it("keeps every day without a period", () => {
    const versions = ["202610072200", "202610012200"];
    expect(dailyVersions(versions, null, now)).toEqual(["202610012200", "202610072200"]);
  });
});
