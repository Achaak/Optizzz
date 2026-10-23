import { describe, expect, it } from "vitest";
import { UNITS } from "../army/units";
import { emptyHuntForm, planInput, type HuntForm } from "../hunt/hunt-form";
import { huntLinkFormat, type HuntToolState } from "./hunt";

const form: HuntForm = {
  army: { JSN: 120_000, SN: 4_000, Tk: 300 },
  levels: { weapons: 12, shield: 11, huntSpeed: 6, cochineal: 3 },
  laying: { nursery: 10, solarium: 9, laying: null },
  launchField: 1_250_000,
  arrivalField: 1_280_000,
  takenSlots: 2,
  objective: "yield",
  ratio: 7.5,
  maxLossShare: 0.015,
  dispatch: "waves",
  huntCount: 3,
  huntAmount: 20_000,
  edited: [
    { amount: 20_000, army: { JSN: 40_000, Tk: 300 } },
    { amount: 18_000, army: { JSN: 80_000, SN: 4_000 } },
  ],
};
const state: HuntToolState = { form, advanced: true };

const wire = (value: unknown) =>
  `1.${btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;

describe("hunt tool link", () => {
  it("round-trips the entries, the settings, the hunts changed by hand and the display", () => {
    expect(huntLinkFormat.decode(huntLinkFormat.encode(state))).toEqual(state);
    const empty = { form: emptyHuntForm(), advanced: false };
    expect(huntLinkFormat.decode(huntLinkFormat.encode(empty))).toEqual(empty);
  });

  it("asks the engine the same plan once read back", () => {
    const read = huntLinkFormat.decode(huntLinkFormat.encode(state));
    expect(read && planInput(read.form)).toEqual(planInput(form));
  });

  it("leaves units at 0 out of the address", () => {
    const withZero = { ...state, form: { ...form, army: { JSN: 5, S: 0 } } };
    expect(huntLinkFormat.decode(huntLinkFormat.encode(withZero))?.form.army).toEqual({ JSN: 5 });
  });

  it("holds a full army, every level and setting under 1,000 characters", () => {
    const every = Object.fromEntries(UNITS.map((unit) => [unit.key, 99_999_999]));
    const full: HuntToolState = {
      form: { ...form, army: every, launchField: 99_999_999, arrivalField: 99_999_999, edited: null },
      advanced: true,
    };
    expect(huntLinkFormat.encode(full).length).toBeLessThan(1000);
  });

  it("refuses a negative count, an unknown objective or a level that is not a whole number", () => {
    const good = huntLinkFormat.encode(state);
    expect(huntLinkFormat.decode(good)).not.toBeNull();
    const json = JSON.parse(atob(good.slice(2).replace(/-/g, "+").replace(/_/g, "/"))) as Record<string, unknown>;
    expect(huntLinkFormat.decode(wire({ ...json, u: [-1] }))).toBeNull();
    expect(huntLinkFormat.decode(wire({ ...json, o: "zero" }))).toBeNull();
    expect(huntLinkFormat.decode(wire({ ...json, l: [1.5, 1, 1, 1] }))).toBeNull();
    expect(huntLinkFormat.decode("2.e30")).toBeNull();
  });
});
