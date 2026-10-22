import { describe, expect, it } from "vitest";
import type { ColonyState } from "@optizzz/game/forecast";
import { fromParisParts } from "@optizzz/game/format/time-format";
import { planTemplate, type PlanContext } from "./template";

const now = new Date(2026, 9, 18, 12, 0, 0);
const HOUR = 3_600_000;
const SECOND = 1000;

// 100 food workers × 48 harvests − 2 400 upkeep = 2 400 food a day.
const state: ColonyState = {
  food: 100_000,
  materials: 0,
  workers: 4400,
  capacities: { food: 500_000, materials: 50_000 },
  foodWorkers: 100,
  materialWorkers: 4300,
  mushroomPerDay: 0,
  armyPerDay: 2400,
  taxRate: 0,
  nextHarvestAt: new Date(now.getTime() + 0.5 * HOUR),
  hunts: [],
  newWorkersGoTo: "none",
};

// Speed 0.1: a JSN takes 30 s, a JS 74 s, an Artilleuse 144 s, a worker 6 s.
const context: PlanContext = {
  speed: 0.1,
  state,
  queueEnd: new Date(now.getTime() + HOUR),
  layable: ["JSN", "SN", "JS", "A"],
  readAt: now,
  now,
};

const army = {
  lines: [
    { unit: "JSN", destination: "lodge" as const, amount: 100 },
    { unit: "JS", destination: "lodge" as const, amount: 50 },
    { unit: "A", destination: "lodge" as const, amount: 10 },
  ],
  target: null,
};

describe("planTemplate", () => {
  it("lays fixed quantities one after the other, after the queue", () => {
    const plan = planTemplate(army, context);
    expect(plan.lines.map((line) => line.count)).toEqual([100, 50, 10]);
    // 100 × 16 + 50 × 30 + 10 × 30.
    expect(plan.food).toBe(3400);
    expect(plan.duration).toBe(8140 * SECOND);
    expect(plan.lines.map((line) => line.endsAt?.getTime())).toEqual([
      now.getTime() + HOUR + 3000 * SECOND,
      now.getTime() + HOUR + 6700 * SECOND,
      now.getTime() + HOUR + 8140 * SECOND,
    ]);
    expect(plan.affordability).toEqual({ kind: "now" });
    // In the Loge: 15 % of 3 400 a day.
    expect(plan.upkeepPerDay).toBeCloseTo(510);
    expect(plan.balanceAfter).toBeCloseTo(1890);
  });

  it("fills a laying duration with the template's shares, each line rounded to the unit", () => {
    const ratio = { ...army, lines: army.lines.map((line, i) => ({ ...line, amount: [10, 5, 1][i] ?? 0 })) };
    const plan = planTemplate({ ...ratio, target: { kind: "duration", hours: 24 } }, context);
    // 10 : 5 : 1 lasts 814 s; 24 h is 106.14 times that.
    expect(plan.lines.map((line) => line.count)).toEqual([1061, 531, 106]);
    expect(plan.duration).toBe(86_388 * SECOND);
  });

  it("ends at a Paris time, after the queue", () => {
    const queueEnd = fromParisParts({ year: 2026, month: 10, day: 18, hours: 20, minutes: 0 });
    const plan = planTemplate(
      {
        lines: [{ unit: "JSN", destination: "lodge", amount: 1 }],
        target: { kind: "until", clock: { hours: 8, minutes: 0 } },
      },
      { ...context, queueEnd },
    );
    // 12 h of 30 s.
    expect(plan.lines[0]?.count).toBe(1440);
    expect(plan.lines[0]?.endsAt).toEqual(fromParisParts({ year: 2026, month: 10, day: 19, hours: 8, minutes: 0 }));
  });

  it("lays what the food pays now, rounded down so that it stays payable", () => {
    const ratio = { ...army, lines: army.lines.map((line, i) => ({ ...line, amount: [10, 5, 1][i] ?? 0 })) };
    const plan = planTemplate(
      { ...ratio, target: { kind: "food" } },
      { ...context, state: { ...state, food: 10_000 } },
    );
    // 10 : 5 : 1 costs 340 food; 10 000 food pays it 29.4 times.
    expect(plan.lines.map((line) => line.count)).toEqual([294, 147, 29]);
    expect(plan.food).toBe(9984);
    expect(plan.affordability).toEqual({ kind: "now" });
  });

  it("can be launched only when every unit is unlocked and the food pays it all now", () => {
    expect(planTemplate(army, context).launchable).toBe(true);

    const locked = planTemplate(
      { ...army, lines: [...army.lines, { unit: "Tk", destination: "lodge", amount: 5 }] },
      context,
    );
    expect(locked.lines.map((line) => line.locked)).toEqual([false, false, false, true]);
    expect(locked.launchable).toBe(false);

    const poor = planTemplate(army, { ...context, state: { ...state, food: 1000 } });
    expect(poor.affordability.kind).toBe("at");
    expect(poor.launchable).toBe(false);

    const workers = planTemplate(
      { lines: [{ unit: "worker", destination: "lodge", amount: 100 }], target: null },
      context,
    );
    expect(workers.lines[0]?.locked).toBe(false);
    expect(workers.upkeepPerDay).toBe(0);
    expect(planTemplate({ lines: [], target: null }, context).launchable).toBe(false);
  });

  it("warns about a line longer than the game's week of laying, without capping it", () => {
    // A week is 20 160 JSN at 30 s.
    const plan = planTemplate(
      {
        lines: [
          { unit: "JSN", destination: "field", amount: 20_161 },
          { unit: "JS", destination: "field", amount: 1 },
        ],
        target: null,
      },
      context,
    );
    expect(plan.lines.map((line) => [line.count, line.tooLong])).toEqual([
      [20_161, true],
      [1, false],
    ]);
  });

  it("repeats fixed quantities once per rotation, the units taking turns in the queue", () => {
    const plan = planTemplate({ ...army, rotations: 10 }, context);
    expect(plan.layings).toHaveLength(30);
    expect(plan.layings.slice(0, 4).map((laying) => [laying.unit, laying.count])).toEqual([
      ["JSN", 100],
      ["JS", 50],
      ["A", 10],
      ["JSN", 100],
    ]);
    expect(plan.lines.map((line) => line.count)).toEqual([1000, 500, 100]);
    expect(plan.duration).toBe(81_400 * SECOND);
    // The first rotation ends 8 140 s after the queue, the last JSN one rotation and 3 000 s before the end.
    expect(plan.layings[2]?.endsAt?.getTime()).toBe(now.getTime() + HOUR + 8140 * SECOND);
    expect(plan.lines[0]?.endsAt?.getTime()).toBe(now.getTime() + HOUR + (9 * 8140 + 3000) * SECOND);
  });

  it("spreads a target over the rotations, the same totals split as evenly as the units allow", () => {
    const ratio = { ...army, lines: army.lines.map((line, i) => ({ ...line, amount: [10, 5, 1][i] ?? 0 })) };
    const plan = planTemplate({ ...ratio, target: { kind: "duration", hours: 24 }, rotations: 10 }, context);
    expect(plan.lines.map((line) => line.count)).toEqual([1061, 531, 106]);
    const jsn = plan.layings.filter((laying) => laying.unit === "JSN").map((laying) => laying.count);
    expect(jsn).toEqual([107, 106, 106, 106, 106, 106, 106, 106, 106, 106]);
    expect(plan.duration).toBe(86_388 * SECOND);
  });

  it("leaves out an empty laying", () => {
    const plan = planTemplate(
      { lines: [{ unit: "A", destination: "lodge", amount: 3 }], target: null, rotations: 1 },
      context,
    );
    expect(plan.layings).toHaveLength(1);
    const few = planTemplate(
      {
        lines: [{ unit: "A", destination: "lodge", amount: 1 }],
        target: { kind: "food" },
        rotations: 4,
      },
      { ...context, state: { ...state, food: 60 } },
    );
    // 2 Artilleuses over 4 rotations: two layings of one.
    expect(few.layings.map((laying) => laying.count)).toEqual([1, 1]);
  });
});
