import { describe, expect, it } from "vitest";
import { amountForDuration, difficulty, foodTarget, huntDurationSeconds, nextDifficultyStep } from "./difficulty";

describe("difficulty", () => {
  it("matches the food of a real report", () => {
    // 07/10 11h08: 118 cm² hunted at 3 886 cm², « les carcasses rapportent 794 ».
    expect(foodTarget(3886, 118)).toBeGreaterThan(792);
    expect(foodTarget(3886, 118)).toBeLessThan(795);
  });

  it("counts a hunting field under 50 cm² as 50", () => {
    // (10 + 50 × 0.01) × 1.04^0 × 3
    expect(difficulty(10, 10)).toBeCloseTo(31.5);
    expect(difficulty(10, 10)).toBe(difficulty(50, 10));
  });

  it("grows 4 % at each step", () => {
    // 50 × 10^0.05 = 56.1: from 57 cm² on, the step is 1.04.
    expect(difficulty(57, 0) / (57 * 0.01 * 3)).toBeCloseTo(1.04);
  });
});

describe("nextDifficultyStep", () => {
  it("finds the first hunting field of the next step", () => {
    // 50 × 10^1.95 = 4 456.8
    expect(nextDifficultyStep(3886)).toBe(4457);
    expect(nextDifficultyStep(4457)).toBeGreaterThan(5000);
  });
});

describe("huntDurationSeconds", () => {
  it("shortens by 10 % per Hunt Speed level", () => {
    // (4 496 + 100) × 0.9³ = 3 350.48
    expect(huntDurationSeconds(4496, 100, 3)).toBe(3350);
    expect(huntDurationSeconds(4496, 100, 0)).toBe(4596);
  });
});

describe("amountForDuration", () => {
  it("finds the largest hunt back within the time", () => {
    const amount = amountForDuration(4496, 3350, 3);
    expect(amount).toBe(100);
    expect(huntDurationSeconds(4496, amount, 3)).toBeLessThanOrEqual(3350);
    expect(huntDurationSeconds(4496, amount + 1, 3)).toBeGreaterThan(3350);
  });

  it("is 0 when even the smallest hunt comes back too late", () => {
    expect(amountForDuration(4496, 60, 3)).toBe(0);
  });
});
