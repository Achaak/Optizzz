import { describe, expect, it } from "vitest";
import { armyFromKeys, emptyArmy, UNITS } from "../army/units";
import { FLOOD_MARGIN, floodPlan } from "../flood";
import { EMPTY_FLOOD, floodLinkFormat, floodToolPlan, type FloodToolState } from "./flood";

const state: FloodToolState = {
  server: "s5",
  attacker: { kind: "player", id: 1234 },
  target: { kind: "position", x: 12, y: null },
  attackerField: 1_000_000,
  targetField: 1_800_000,
  army: armyFromKeys({ JSN: 500_000, S: 120_000, TkE: 3_000 }),
  attackSpeed: 4,
  weapons: 12,
  shield: 11,
  underWay: 1,
  defense: armyFromKeys({ JSN: 30_000, Tu: 200 }),
};

const wire = (value: unknown) =>
  `1.${btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;

describe("flood tool link", () => {
  it("round-trips the server, both ends, both fields, the army, the levels and the defense", () => {
    expect(floodLinkFormat.decode(floodLinkFormat.encode(state))).toEqual(state);
    expect(floodLinkFormat.decode(floodLinkFormat.encode(EMPTY_FLOOD))).toEqual(EMPTY_FLOOD);
  });

  it("stays short: armies as counts in UNITS order, without the trailing zeros", () => {
    const every = UNITS.map(() => 9_999_999);
    expect(floodLinkFormat.encode({ ...state, army: every, defense: every }).length).toBeLessThan(500);
  });

  it("refuses a negative count, too many units or a broken server", () => {
    const good = { s: null, a: null, c: null, f: [10, 20], u: [5], v: 1, w: 0, b: 0, e: 0, d: null };
    expect(floodLinkFormat.decode(wire(good))).not.toBeNull();
    expect(floodLinkFormat.decode(wire({ ...good, u: [-5] }))).toBeNull();
    expect(floodLinkFormat.decode(wire({ ...good, d: Array(UNITS.length + 1).fill(1) }))).toBeNull();
    expect(floodLinkFormat.decode(wire({ ...good, s: "fourmizzz.fr" }))).toBeNull();
    expect(floodLinkFormat.decode(wire({ ...good, v: 2.5 }))).toBeNull();
  });
});

describe("floodToolPlan", () => {
  it("says which fields are missing before planning", () => {
    expect(floodToolPlan(EMPTY_FLOOD)).toEqual({
      kind: "missing",
      fields: ["attackerField", "targetField", "attackSpeed"],
    });
    // Weapons and Shield only matter against a defense.
    const noLevels = { ...state, weapons: null, shield: null };
    expect(floodToolPlan({ ...noLevels, defense: null }).kind).toBe("plan");
    expect(floodToolPlan(noLevels)).toEqual({ kind: "missing", fields: ["weapons", "shield"] });
  });

  it("plans with Attack Speed + 1 slots, less the attacks on their way, and the extension's margin", () => {
    const plan = floodToolPlan(state);
    expect(plan).toEqual({
      kind: "plan",
      slots: 4,
      ...floodPlan({
        attackerField: 1_000_000,
        targetField: 1_800_000,
        slots: 4,
        margin: FLOOD_MARGIN,
        available: state.army,
        defense: state.defense,
        levels: { weapons: 12, shield: 11 },
      }),
    });
    expect(plan.kind === "plan" && plan.attacks.length).toBe(3);
  });

  it("counts a defense of nobody as no defense", () => {
    const plan = floodToolPlan({ ...state, defense: emptyArmy(), weapons: null });
    expect(plan.kind === "plan" && plan.attacks.every((attack) => attack.lost === null)).toBe(true);
  });
});
