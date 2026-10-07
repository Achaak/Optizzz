import { describe, expect, it } from "vitest";
import type { ColonyState } from "../resource-forecast/forecast";
import reineHtml from "./__fixtures__/reine-form.html?raw";
import { maxAffordable, planLaying, readLayingRows, readOrder } from "./laying";

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");
const now = new Date(2026, 9, 7, 12, 0, 0);
const HOUR = 3_600_000;

// 2 000 food; 100 workers × 48 harvests − 2 400 upkeep = 2 400 food a day.
const state: ColonyState = {
  food: 2000,
  materials: 0,
  workers: 4400,
  capacities: { food: 50_000, materials: 50_000 },
  foodWorkers: 100,
  materialWorkers: 4300,
  mushroomPerDay: 0,
  armyPerDay: 2400,
  taxRate: 0,
  nextHarvestAt: new Date(now.getTime() + 0.5 * HOUR),
  hunts: [],
  newWorkersGoTo: "none",
};

describe("readLayingRows", () => {
  it("finds each unit that can be laid, with its destination; locked units have no form", () => {
    const rows = readLayingRows(parse(reineHtml));
    expect(rows.map((row) => [row.suffix, row.unitKey])).toEqual([
      ["", null],
      ["1", "JSN"],
    ]);
  });

  it("reads the order as the game shows it once a number is typed", () => {
    const [workers, dwarves] = readLayingRows(parse(reineHtml));
    if (!workers || !dwarves) throw new Error("fixture");
    expect(readOrder(workers)).toEqual({ count: 200, food: 1000, duration: (33 * 60 + 20) * 1000, destination: null });
    // An empty field: nothing ordered, though the game shows the cost of one.
    expect(readOrder(dwarves)).toMatchObject({ count: 0, destination: "lodge" });
  });

  it("takes the count the game parsed from « 2k »", () => {
    const doc = parse(reineHtml);
    const [, dwarves] = readLayingRows(doc);
    if (!dwarves) throw new Error("fixture");
    dwarves.input.value = "2k";
    const parsed = doc.getElementById("nombre_de_ponte1") as HTMLInputElement | null;
    if (parsed) parsed.value = "2000";
    expect(readOrder(dwarves).count).toBe(2000);
  });
});

describe("planLaying", () => {
  const order = { count: 100, food: 1600, duration: 5000 * 1000, destination: "lodge" as const };

  it("ends after the layings already queued, and can be paid now", () => {
    const queueEnd = new Date(now.getTime() + HOUR);
    const plan = planLaying(order, state, { queueEnd, huntingField: 4496 }, now);
    expect(plan.affordability).toEqual({ kind: "now" });
    expect(plan.endsAt).toEqual(new Date(queueEnd.getTime() + 5000 * 1000));
  });

  it("adds the upkeep of the lodge (15 % of the cost a day) to the food balance", () => {
    const plan = planLaying(order, state, { queueEnd: now, huntingField: 4496 }, now);
    expect(plan.upkeepPerDay).toBeCloseTo(240);
    expect(plan.balanceAfter).toBeCloseTo(2400 - 240);
  });

  it("waits for the food when it cannot be paid yet, then lays", () => {
    const plan = planLaying({ ...order, food: 3000 }, state, { queueEnd: now, huntingField: 4496 }, now);
    expect(plan.affordability.kind).toBe("at");
    if (plan.affordability.kind !== "at") return;
    expect(plan.endsAt).toEqual(new Date(plan.affordability.at.getTime() + 5000 * 1000));
  });

  it("counts the workers left without work beyond the hunting field", () => {
    const plan = planLaying(
      { count: 200, food: 1000, duration: 1000, destination: null },
      state,
      { queueEnd: now, huntingField: 4496 },
      now,
    );
    expect(plan.idleWorkers).toBe(104);
    expect(plan.upkeepPerDay).toBe(0);
  });
});

describe("maxAffordable", () => {
  it("lays as many as the food pays for now, or by a later time", () => {
    expect(maxAffordable(16, state, now, now)).toBe(125);
    // Within 3 hours, harvests bring 6 × 100 food on top and upkeep takes 300.
    const later = maxAffordable(16, state, new Date(now.getTime() + 3 * HOUR), now);
    expect(later).toBeGreaterThan(125);
  });

  it("is capped by the food warehouse", () => {
    expect(maxAffordable(16, { ...state, food: 49_990 }, new Date(now.getTime() + 24 * HOUR), now)).toBe(3125);
  });
});
