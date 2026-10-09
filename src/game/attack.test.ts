import { describe, expect, it } from "vitest";
import { attackSlots, inRange, maxTake, takeAtLimit } from "./attack";

describe("attack rules", () => {
  it("takes 20 % of the field, rounded down", () => {
    expect(maxTake(5055)).toBe(1011);
  });

  it("allows from 50 % included to 300 % excluded", () => {
    expect(inRange(5055, 2528)).toBe(true);
    expect(inRange(5055, 2527)).toBe(false);
    expect(inRange(5055, 15164)).toBe(true);
    expect(inRange(5055, 15165)).toBe(false);
  });

  it("keeps the margin above 50 %", () => {
    expect(inRange(1000, 500)).toBe(true);
    expect(inRange(1000, 500, 0.01)).toBe(false);
    expect(inRange(1000, 505, 0.01)).toBe(true);
  });

  it("finds the take that leaves the target at the limit", () => {
    const take = takeAtLimit(1000, 800, 0.01);
    expect(inRange(1000 + take, 800 - take, 0.01)).toBe(true);
    expect(inRange(1000 + take + 1, 800 - take - 1, 0.01)).toBe(false);
  });

  it("counts Attack Speed + 1 attacks at once", () => {
    expect(attackSlots(3, 1)).toBe(3);
    expect(attackSlots(0, 2)).toBe(0);
  });
});
