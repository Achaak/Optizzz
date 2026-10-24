import { describe, expect, it } from "vitest";
import { shortDate } from "./short-date";

describe("shortDate", () => {
  const now = new Date("2026-10-24T12:00:00Z");

  it("gives the Paris day and the short month", () => {
    expect(shortDate(new Date("2026-10-24T08:00:00Z"), now)).toBe("24 oct.");
    // 23:30 UTC is already the next day in Paris.
    expect(shortDate(new Date("2026-10-23T22:30:00Z"), now)).toBe("24 oct.");
  });

  it("adds the year when it is not this one", () => {
    expect(shortDate(new Date("2025-01-03T12:00:00Z"), now)).toBe("3 janv. 2025");
  });
});
