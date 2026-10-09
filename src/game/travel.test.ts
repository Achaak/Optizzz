import { describe, expect, it } from "vitest";
import { distance, travelTime } from "./travel";

describe("travelTime", () => {
  // Reference values computed separately with the Toolzzz formula:
  // floor(0.9^level × 637200 × (1 − e^(−d/350))).
  it("returns the time in seconds without speed bonus", () => {
    expect(travelTime(10, 0)).toBe(17948);
  });

  it("reduces the time with the Attack Speed level", () => {
    expect(travelTime(10, 3)).toBe(13084);
  });

  it("is 0 on the spot", () => {
    expect(travelTime(0, 0)).toBe(0);
  });

  // Measured on a profile (Membre.php shows the game's own travel time): 10H 1m 2s, see
  // docs/research/temps-de-trajet.md.
  it("matches the game to the second, rounded down", () => {
    expect(travelTime(distance({ x: 95, y: 48 }, { x: 75, y: 28 }), 3)).toBe(10 * 3600 + 60 + 2);
  });
});

describe("distance", () => {
  it("is the straight line between two squares", () => {
    expect(distance({ x: 95, y: 48 }, { x: 94, y: 51 })).toBeCloseTo(3.162, 3);
  });
});
