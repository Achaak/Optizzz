import { describe, expect, it } from "vitest";
import type { ColonyState } from "@/game/forecast";
import reineHtml from "./__fixtures__/reine-form.html?raw";
import { fromParisParts } from "@/utils/time-format";
import {
  layingShortcuts,
  MAX_LAYING_MS,
  maxAffordable,
  nextParisTime,
  planLaying,
  queuedWorkers,
  readLayingRows,
  readLayingSpeed,
  readOrder,
  readUnitCost,
  type ShortcutGroup,
} from "./laying";
import { DEFAULT_LAYING_SETTINGS } from "./settings";

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
    const plan = planLaying(order, state, { queueEnd, huntingField: 4496, queuedWorkers: 0 }, now);
    expect(plan.affordability).toEqual({ kind: "now" });
    expect(plan.endsAt).toEqual(new Date(queueEnd.getTime() + 5000 * 1000));
  });

  it("adds the upkeep of the lodge (15 % of the cost a day) to the food balance", () => {
    const plan = planLaying(order, state, { queueEnd: now, huntingField: 4496, queuedWorkers: 0 }, now);
    expect(plan.upkeepPerDay).toBeCloseTo(240);
    expect(plan.balanceAfter).toBeCloseTo(2400 - 240);
  });

  it("waits for the food when it cannot be paid yet, then lays", () => {
    const plan = planLaying(
      { ...order, food: 3000 },
      state,
      { queueEnd: now, huntingField: 4496, queuedWorkers: 0 },
      now,
    );
    expect(plan.affordability.kind).toBe("at");
    if (plan.affordability.kind !== "at") return;
    expect(plan.endsAt).toEqual(new Date(plan.affordability.at.getTime() + 5000 * 1000));
  });

  it("counts the workers left without work beyond the hunting field", () => {
    const plan = planLaying(
      { count: 200, food: 1000, duration: 1000, destination: null },
      state,
      { queueEnd: now, huntingField: 4496, queuedWorkers: 0 },
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

describe("queuedWorkers", () => {
  it("adds up the workers of the laying queue, not the other units", () => {
    expect(queuedWorkers(["6 Jeunes Soldates Naines", "1 224 ouvrières", "1 ouvrière"])).toBe(1225);
  });
});

describe("readLayingSpeed and readUnitCost", () => {
  it("reads the player's laying speed in the page's script, and one unit's food and exact time", () => {
    const doc = parse(reineHtml);
    const speed = readLayingSpeed(doc);
    expect(speed).toBeCloseTo(1 / 6);
    const [workers, dwarves] = readLayingRows(doc);
    if (!workers || !dwarves) throw new Error("fixture");
    expect(readUnitCost(workers, speed)).toEqual({ food: 5, duration: expect.closeTo(10_000) as number });
    // Nothing chosen: the game shows the cost of one.
    expect(readUnitCost(dwarves, speed)).toEqual({ food: 16, duration: expect.closeTo(50_000) as number });
  });

  it("divides the time the game shows when the speed is not in the page", () => {
    const [workers] = readLayingRows(parse(reineHtml));
    if (!workers) throw new Error("fixture");
    expect(readUnitCost(workers, null).duration).toBe(10_000);
  });

  it("puts the planner in the wide description cell, next to the game's form", () => {
    const [workers] = readLayingRows(parse(reineHtml));
    expect(workers?.panel.classList.contains("desciption_amelioration")).toBe(true);
  });
});

describe("nextParisTime", () => {
  it("is later today, or tomorrow once the time is past", () => {
    const morning = fromParisParts({ year: 2026, month: 10, day: 7, hours: 6, minutes: 0 });
    const evening = fromParisParts({ year: 2026, month: 10, day: 7, hours: 21, minutes: 0 });
    const clock = { hours: 8, minutes: 0 };
    expect(nextParisTime(morning, clock)).toEqual(fromParisParts({ year: 2026, month: 10, day: 7, ...clock }));
    expect(nextParisTime(evening, clock)).toEqual(fromParisParts({ year: 2026, month: 10, day: 8, ...clock }));
  });
});

describe("layingShortcuts", () => {
  const context = { queueEnd: now, huntingField: 4496, queuedWorkers: 0 };
  const shortcuts = (overrides: Partial<Parameters<typeof layingShortcuts>[0]> = {}) =>
    layingShortcuts({
      destination: "lodge",
      unit: { food: 16, duration: 50_000 },
      state,
      context,
      settings: DEFAULT_LAYING_SETTINGS,
      readAt: now,
      now,
      ...overrides,
    });
  const find = (groups: ShortcutGroup[], label: string) =>
    groups.flatMap((group) => group.shortcuts).find((shortcut) => shortcut.label === label);

  it("offers all the food pays now and within the hours set, a laying of the hours set, and a zero balance", () => {
    const groups = shortcuts();
    expect(groups.map((group) => group.label)).toEqual(["Tout payer", "Durée de ponte", "Entretien"]);
    expect(groups[0]?.shortcuts.map((shortcut) => shortcut.label)).toEqual(["maintenant", "dans 3 h", "dans 12 h"]);
    // 2 000 food at 16 each.
    expect(find(groups, "maintenant")?.count).toBe(125);
    expect(find(groups, "dans 3 h")?.count).toBe(maxAffordable(16, state, new Date(now.getTime() + 3 * HOUR), now));
    // 50 s each: 72 an hour.
    expect(find(groups, "1 h")?.count).toBe(72);
    expect(find(groups, "8 h")?.count).toBe(576);
    // 2 400 food a day, 2.4 a day for each dwarf in the lodge.
    expect(find(groups, "bilan à zéro")?.count).toBe(1000);
  });

  it("ends « jusqu'à » at the time set, after the layings already queued", () => {
    const start = fromParisParts({ year: 2026, month: 10, day: 7, hours: 20, minutes: 0 });
    const groups = shortcuts({ readAt: start, now: start, context: { ...context, queueEnd: start } });
    const until = groups[1]?.shortcuts.at(-1);
    expect(until?.label).toBe("jusqu'à demain 8 h 00");
    // 12 hours at 50 s each.
    expect(until?.count).toBe(864);
  });

  it("follows the hours set by the player", () => {
    const groups = shortcuts({ settings: { ...DEFAULT_LAYING_SETTINGS, payDelays: [6], durations: [2, 4] } });
    expect(groups[0]?.shortcuts.map((shortcut) => shortcut.label)).toEqual(["maintenant", "dans 6 h"]);
    expect(groups[1]?.shortcuts.map((shortcut) => shortcut.label).slice(0, 2)).toEqual(["2 h", "4 h"]);
  });

  it("never offers more than a week of laying, as the game's slider", () => {
    const groups = shortcuts({ state: { ...state, food: 1e9, capacities: null } });
    expect(find(groups, "maintenant")?.count).toBe(Math.floor(MAX_LAYING_MS / 50_000));
  });

  it("does not cap workers at the hunting field, but offers to fill it", () => {
    const groups = shortcuts({
      destination: null,
      unit: { food: 5, duration: 10_000 },
      state: { ...state, food: 10_000 },
    });
    expect(groups.map((group) => group.label)).toEqual(["Tout payer", "Durée de ponte", "Terrain"]);
    expect(find(groups, "maintenant")?.count).toBe(2000);
    // 4 496 cm², 4 400 workers.
    expect(find(groups, "jusqu'au TDC")?.count).toBe(96);
  });

  it("says how many workers already idle when the hunting field is full", () => {
    const groups = shortcuts({ destination: null, context: { ...context, huntingField: 4000, queuedWorkers: 100 } });
    const fill = find(groups, "jusqu'au TDC");
    expect(fill?.count).toBe(0);
    expect(fill?.empty).toBe("TDC plein, 500 sans travail");
  });

  it("says when the food warehouse caps « Tout payer », and drops the later delays it makes equal", () => {
    // 50 000 food at most: 3 125 dwarves.
    const groups = shortcuts({ state: { ...state, food: 49_990 } });
    expect(groups[0]?.shortcuts).toEqual([
      expect.objectContaining({ label: "maintenant", count: 3124 }),
      expect.objectContaining({ label: "dans 3 h", count: 3125, limit: "entrepôt plein" }),
    ]);
  });
});
