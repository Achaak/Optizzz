import { describe, expect, it } from "vitest";
import { clockValue, parseClock, parseHours } from "./settings";

describe("parseHours", () => {
  it("reads whole hours from 1 to a week, sorted, without repeats, 4 at most", () => {
    expect(parseHours("12, 3 h")).toEqual([3, 12]);
    expect(parseHours("0 3 3 200")).toEqual([3]);
    expect(parseHours("1 2 3 4 5")).toEqual([1, 2, 3, 4]);
    expect(parseHours("")).toEqual([]);
  });
});

describe("parseClock", () => {
  it("reads a time field, or « 8h30 »", () => {
    expect(parseClock("08:00")).toEqual({ hours: 8, minutes: 0 });
    expect(parseClock("8h30")).toEqual({ hours: 8, minutes: 30 });
    expect(parseClock("25:00")).toBeNull();
    expect(parseClock("")).toBeNull();
    expect(clockValue({ hours: 8, minutes: 5 })).toBe("08:05");
  });
});
