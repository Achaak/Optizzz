import { describe, expect, it } from "vitest";
import { HUNT_REPORTS, type HuntReport } from "./__fixtures__/hunt-reports";
import { fight } from "./combat";
import { PREYS } from "./prey";
import { armyFromKeys, UNITS } from "./units";

const packOf = (report: HuntReport) => PREYS.map((prey) => report.prey[prey.plural] ?? report.prey[prey.name] ?? 0);

const JSN = UNITS.findIndex((unit) => unit.key === "JSN");
// Shield read on laboratoire.php on 2026-10-07; unknown for older fights.
const SHIELD_ON_OCT_7 = 4;
const onOct7 = HUNT_REPORTS.filter((report) => report.date.startsWith("07/10"));

describe("fight, replayed against real hunt reports", () => {
  it("reads every prey name of the reports", () => {
    for (const report of HUNT_REPORTS) {
      const total = Object.values(report.prey).reduce((sum, count) => sum + count, 0);
      expect(packOf(report).reduce((sum, count) => sum + count, 0)).toBe(total);
    }
  });

  it.each(HUNT_REPORTS)("$date: wins and deals the reported damage", (report) => {
    const result = fight(armyFromKeys(report.sent), packOf(report), {
      weapons: report.weaponsLevel,
      shield: 0,
      cochineal: 0,
    });
    const base = result.damageDealt / (1 + 0.1 * report.weaponsLevel);
    expect(result.win).toBe(true);
    expect(base).toBeCloseTo(report.attackBase, 6);
    expect(Math.ceil(result.damageDealt - base - 1e-9)).toBe(report.attackBonus);
  });

  it.each(HUNT_REPORTS)("$date: takes the reported damage, rounded up", (report) => {
    const result = fight(armyFromKeys(report.sent), packOf(report), {
      weapons: report.weaponsLevel,
      shield: 0,
      cochineal: 0,
    });
    expect(Math.ceil(result.damageTaken - 1e-9)).toBe(report.damageTaken);
  });

  it.each(onOct7)("$date: counts the reported dead ants and promotions", (report) => {
    const result = fight(armyFromKeys(report.sent), packOf(report), {
      weapons: report.weaponsLevel,
      shield: SHIELD_ON_OCT_7,
      cochineal: 0,
    });
    expect(result.reportedDead[JSN]).toBe(report.antsKilled);
    expect(result.promoted[JSN]).toBe(report.promoted);
  });

  it("loses a unit wounded past half its hp, unlike the report", () => {
    // 07/10 11h08: 55.9 damage on 11.2-hp young dwarves = 4.99 units: the report says 4 dead, 5 do not come back.
    const report = onOct7[0];
    if (!report) throw new Error("fixture");
    const result = fight(armyFromKeys(report.sent), packOf(report), {
      weapons: report.weaponsLevel,
      shield: SHIELD_ON_OCT_7,
      cochineal: 0,
    });
    expect(result.reportedDead[JSN]).toBe(4);
    expect(result.lost[JSN]).toBe(5);
  });

  it("loses the whole army when the prey survive", () => {
    const army = armyFromKeys({ JSN: 10 });
    const pack = PREYS.map((_, i) => (i === 0 ? 100 : 0));
    const result = fight(army, pack, { weapons: 0, shield: 0, cochineal: 0 });
    expect(result.win).toBe(false);
    expect(result.lost[JSN]).toBe(10);
  });
});
