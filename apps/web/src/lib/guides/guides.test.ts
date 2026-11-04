import { describe, expect, it } from "vitest";
import { GUIDES, guide, guidePath, longDay } from "./guides";

describe("guides", () => {
  it("gives each guide an address under /guides", () => {
    expect(guidePath("tdc-chain")).toBe("/guides/tdc-chain");
  });

  it("dates every written guide", () => {
    for (const entry of GUIDES.filter((candidate) => candidate.ready))
      expect(entry.updated).toMatch(/^\d{4}-\d\d-\d\d$/);
  });

  it("refuses an unknown guide", () => {
    expect(() => guide("nope")).toThrow();
  });

  it("writes a day in words", () => {
    expect(longDay("2026-11-04")).toBe("4 novembre 2026");
  });
});
