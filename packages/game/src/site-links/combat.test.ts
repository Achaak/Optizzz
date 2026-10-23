import { describe, expect, it } from "vitest";
import { emptyForm, simulate, type SimulatorForm } from "../army/battle-form";
import { UNITS } from "../army/units";
import { combatLinkFormat, type CombatToolState } from "./combat";

const form: SimulatorForm = {
  attacker: { army: { JSN: 120_000, Tk: 4_000, TuE: 2_500 }, weapons: 12, shield: 11, field: 1_250_000, aphids: 9 },
  defender: {
    armies: { field: { JSN: 50_000 }, nest: { Tk: 400, Tu: 3_000 }, lodge: { JSN: 19, TuE: 5 } },
    weapons: 10,
    shield: 12,
    dome: 14,
    lodge: 8,
    field: 980_000,
    food: 12_000_000,
    materials: 8_500_000,
  },
  target: "nest",
};
const state: CombatToolState = { form, mine: "defend" };

const wire = (value: unknown) =>
  `1.${btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;

describe("combat tool link", () => {
  it("round-trips both sides, the place attacked and the side of « Mes niveaux »", () => {
    expect(combatLinkFormat.decode(combatLinkFormat.encode(state))).toEqual(state);
    const empty = { form: emptyForm(), mine: "attack" as const };
    expect(combatLinkFormat.decode(combatLinkFormat.encode(empty))).toEqual(empty);
  });

  it("leaves units at 0 out of the address", () => {
    const withZero = { ...state, form: { ...form, attacker: { ...form.attacker, army: { JSN: 5, S: 0 } } } };
    expect(combatLinkFormat.decode(combatLinkFormat.encode(withZero))?.form.attacker.army).toEqual({ JSN: 5 });
  });

  it("holds a full battle under 1,000 characters", () => {
    const every = Object.fromEntries(UNITS.map((unit) => [unit.key, 9_999_999]));
    const full: CombatToolState = {
      form: {
        ...form,
        attacker: { ...form.attacker, army: every },
        defender: { ...form.defender, armies: { field: every, nest: every, lodge: every } },
      },
      mine: "attack",
    };
    expect(combatLinkFormat.encode(full).length).toBeLessThan(1000);
  });

  it("gives the same fight once read back", () => {
    const read = combatLinkFormat.decode(combatLinkFormat.encode(state));
    expect(read && simulate(read.form)).toEqual(simulate(form));
  });

  it("refuses too many units, a negative count or an unknown place", () => {
    const good = {
      a: { u: [5], w: 1, s: 1, f: 10, p: 0 },
      d: { u: { f: [], n: [], l: [] }, w: 0, s: 0, o: 0, g: 0, f: 10, n: 0, m: 0 },
      t: "field",
      m: "a",
    };
    expect(combatLinkFormat.decode(wire(good))).not.toBeNull();
    expect(combatLinkFormat.decode(wire({ ...good, a: { ...good.a, u: Array(UNITS.length + 1).fill(1) } }))).toBeNull();
    expect(combatLinkFormat.decode(wire({ ...good, a: { ...good.a, u: [-5] } }))).toBeNull();
    expect(combatLinkFormat.decode(wire({ ...good, t: "moon" }))).toBeNull();
    expect(combatLinkFormat.decode(wire({ ...good, a: { ...good.a, w: 1.5 } }))).toBeNull();
  });
});
