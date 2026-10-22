import { describe, expect, it } from "vitest";
import { bestSpeedUp, costGrowthOf, levelsAhead, SPEED_UP_FACTOR, speedUpFirst, speedUpLevels } from "./speed-up";

const now = new Date("2026-10-16T12:00:00Z");
const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000);
const HOUR = 3_600_000;

describe("speedUpFirst", () => {
  it("cuts 10 % of the current time per level, as the game's level-0 times show", () => {
    // Architecture 7: Caserne 0 → 1 in 96 s, 200 s × 0.9⁷; Salle d'analyse 3: Acide in 7 290 s, 10 000 s × 0.9³.
    expect(200 * SPEED_UP_FACTOR ** 7).toBeCloseTo(95.66);
    expect(10_000 * SPEED_UP_FACTOR ** 3).toBeCloseTo(7290);
  });

  it("is worth it when the speed-up ends before the time it saves", () => {
    // A 20 h building, Architecture in 1 h 40: it ends at 1 h 40 + 18 h instead of 20 h.
    const advice = speedUpFirst({ now, duration: 20 * HOUR, startsAt: now, speedUpReady: at(100), levels: 1 });
    expect(advice.endsNow).toEqual(at(20 * 60));
    expect(advice.endsAfter).toEqual(at(100 + 18 * 60));
    expect(advice.saved).toBe(20 * 60_000);
  });

  it("is not when the speed-up takes longer than it saves", () => {
    const advice = speedUpFirst({ now, duration: 2 * HOUR, startsAt: now, speedUpReady: at(100), levels: 1 });
    expect(advice.saved).toBe(-(100 - 12) * 60_000);
  });

  it("costs nothing while the row cannot start anyway (queue busy, not paid yet)", () => {
    // The construction queue ends in 3 h: Architecture is ready before the building could start.
    const advice = speedUpFirst({ now, duration: 2 * HOUR, startsAt: at(180), speedUpReady: at(100), levels: 1 });
    expect(advice.endsNow).toEqual(at(300));
    expect(advice.endsAfter).toEqual(at(180 + 108));
    expect(advice.saved).toBe(12 * 60_000);
  });

  it("counts every level already queued", () => {
    const advice = speedUpFirst({ now, duration: 10 * HOUR, startsAt: now, speedUpReady: at(30), levels: 2 });
    expect(advice.endsAfter).toEqual(at(30 + 600 * 0.81));
  });
});

describe("speedUpLevels", () => {
  it("chains the levels, each 1.7 × longer for a research, paid one after the other", () => {
    const paidAt = (share: number) => (share <= 3 ? now : null);
    const plans = speedUpLevels({ start: at(10), queued: null, duration: HOUR, growth: 1.7, paidAt, max: 5 });
    // 1 and 1 + 2 times the first level's cost are paid now, 1 + 2 + 4 never.
    expect(plans).toEqual([
      { levels: 1, ready: at(70) },
      { levels: 2, ready: at(70 + 102) },
    ]);
  });

  it("starts with the levels already queued, then adds more after them", () => {
    const plans = speedUpLevels({
      start: at(30),
      queued: { levels: 1, ready: at(20) },
      duration: HOUR,
      growth: 1.6,
      paidAt: () => now,
      max: 1,
    });
    expect(plans).toEqual([
      { levels: 1, ready: at(20) },
      { levels: 2, ready: at(90) },
    ]);
  });

  it("waits for each level to be paid", () => {
    const plans = speedUpLevels({
      start: now,
      queued: null,
      duration: HOUR,
      growth: 1.6,
      paidAt: () => at(120),
      max: 1,
    });
    expect(plans).toEqual([{ levels: 1, ready: at(180) }]);
  });
});

describe("bestSpeedUp", () => {
  const row = { now, duration: 40 * HOUR, startsAt: now };

  it("takes as many levels as make the row end soonest", () => {
    // Levels of 1 h, 1 h 42, 2 h 53: three levels end the 40 h building 4 h 34 sooner than two.
    const plans = speedUpLevels({ start: now, queued: null, duration: HOUR, growth: 1.7, paidAt: () => now, max: 10 });
    const best = bestSpeedUp(row, plans);
    expect(best?.plan.levels).toBeGreaterThan(1);
    for (const plan of plans) {
      expect(speedUpFirst({ ...row, speedUpReady: plan.ready, levels: plan.levels }).saved).toBeLessThanOrEqual(
        best?.saved ?? 0,
      );
    }
  });

  it("is null when no plan ends sooner", () => {
    expect(bestSpeedUp({ now, duration: HOUR, startsAt: now }, [{ levels: 1, ready: at(100) }])).toBeNull();
  });

  it("keeps fewer levels when one more saves less than a minute", () => {
    // 40 h: one level ends at 1 h + 36 h = 37 h; two levels ready at 4 h 35 min 30 s end at + 32 h 24, 30 s sooner.
    const plans = [
      { levels: 1, ready: at(60) },
      { levels: 2, ready: at(275.5) },
    ];
    expect(bestSpeedUp(row, plans)?.plan.levels).toBe(1);
    expect(
      bestSpeedUp(
        row,
        [plans[0], { levels: 2, ready: at(270) }].flatMap((plan) => plan ?? []),
      )?.plan.levels,
    ).toBe(2);
  });
});

describe("levelsAhead", () => {
  it("adds up the cost (× 2 a level) and the time (× growth a level) of the next levels", () => {
    const cost = { food: 100, materials: 1000, workers: 10 };
    expect(levelsAhead({ cost, duration: 60_000, growth: 1.5, count: 3 })).toEqual([
      { levels: 1, cost, duration: 60_000 },
      { levels: 2, cost: { food: 300, materials: 3000, workers: 30 }, duration: 150_000 },
      { levels: 3, cost: { food: 700, materials: 7000, workers: 70 }, duration: 285_000 },
    ]);
  });

  it("rounds each level of a cost that does not double, as the game does (Champignonnière: × 1.85)", () => {
    const cost = { food: 0, materials: 90, workers: 0 };
    const levels = levelsAhead({ cost, duration: 120_000, growth: 1.6, costGrowth: 1.85, count: 4 });
    // Its levels cost 90, 167, 308 and 570 materials.
    expect(levels.map((level) => level.cost.materials)).toEqual([90, 257, 565, 1135]);
  });
});

describe("costGrowthOf", () => {
  it("doubles every cost but the Champignonnière's, × 1.85", () => {
    expect(costGrowthOf("Champignonnière")).toBe(1.85);
    expect(costGrowthOf("champignonniere")).toBe(1.85);
    expect(costGrowthOf("Entrepôt de Nourriture")).toBe(2);
  });
});
