import { describe, expect, it } from "vitest";
import { formatDuration, travelTime } from "./travel";

describe("travelTime", () => {
  // Reference values computed separately with the Toolzzz formula:
  // ceil(0.9^level × 637200 × (1 − e^(−d/350))).
  it("returns the time in seconds without speed bonus", () => {
    expect(travelTime(10, 0)).toBe(17949);
  });

  it("reduces the time with the Attack Speed level", () => {
    expect(travelTime(10, 3)).toBe(13085);
  });

  it("is 0 on the spot", () => {
    expect(travelTime(0, 0)).toBe(0);
  });
});

describe("formatDuration", () => {
  it("shows hours, minutes and seconds", () => {
    expect(formatDuration(17949)).toBe("4h 59m 09s");
  });

  it("adds days beyond 24h", () => {
    expect(formatDuration(90061)).toBe("1j 1h 01m 01s");
  });

  it("omits hours under one hour", () => {
    expect(formatDuration(125)).toBe("2m 05s");
  });
});
