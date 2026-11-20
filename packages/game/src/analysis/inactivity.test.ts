import { describe, expect, it } from "vitest";
import { probableInactivity } from "./inactivity";

const night = (field: number, building = 100, technology = 50) => ({ field, building, technology });

describe("probableInactivity", () => {
  it("is inactive when nothing moved for 3 nights", () => {
    expect(probableInactivity([night(900), night(1000), night(1000), night(1000), night(1000)])).toEqual({
      days: 3,
      onlyLosses: false,
    });
  });

  it("is not inactive after only 2 nights without a move", () => {
    expect(probableInactivity([night(900), night(1000), night(1000), night(1000)])).toBeNull();
  });

  it("stays inactive when the field only went down, and says so", () => {
    expect(probableInactivity([night(1000), night(800), night(800), night(640), night(640)])).toEqual({
      days: 4,
      onlyLosses: true,
    });
  });

  it("is woken by a gain of field or a score that rose", () => {
    expect(probableInactivity([night(1000), night(1000), night(1000), night(1100), night(1100)])).toBeNull();
    expect(probableInactivity([night(1000), night(1000), night(1000), night(1000, 101), night(1000, 101)])).toBeNull();
    expect(probableInactivity([night(1000), night(1000), night(1000), night(1000, 100, 51)])).toBeNull();
  });
});
