import { describe, expect, it } from "vitest";
import { formatDuration } from "./travel";

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
