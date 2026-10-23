import { describe, expect, it } from "vitest";
import { armyFromKeys } from "../army/units";
import {
  baseInput,
  chainDrafts,
  emptyHuntForm,
  layingSpeed,
  missingEntries,
  planInput,
  type HuntForm,
} from "./hunt-form";

const form: HuntForm = {
  ...emptyHuntForm(),
  army: { JSN: 2112, SN: 146 },
  levels: { weapons: 4, shield: 4, huntSpeed: 3, cochineal: 0 },
  launchField: 4496,
};

describe("planInput", () => {
  it("is what the launcher asks the engine: free slots, arrival at the launch field unless typed", () => {
    expect(planInput(form)).toEqual({
      army: armyFromKeys({ JSN: 2112, SN: 146 }),
      field: 4496,
      fieldAtLaunch: 4496,
      slots: 4,
      levels: { weapons: 4, shield: 4, huntSpeed: 3, cochineal: 0 },
      objective: { kind: "ratio", ratio: 8 },
      dispatch: "mix",
    });
  });

  it("takes the hunts away out of the slots, and keeps a forced count within them", () => {
    const input = planInput({ ...form, takenSlots: 2, huntCount: 3, arrivalField: 4700 });
    expect(input?.slots).toBe(2);
    expect(input?.huntCount).toBe(2);
    expect(input?.field).toBe(4700);
    expect(planInput({ ...form, takenSlots: 9 })?.slots).toBe(0);
  });

  it("asks the « Rendement » objective and a forced surface", () => {
    const input = planInput({ ...form, objective: "yield", maxLossShare: 0.02, huntAmount: 120, dispatch: "waves" });
    expect(input?.objective).toEqual({ kind: "yield", maxLossShare: 0.02 });
    expect(input?.huntAmount).toBe(120);
    expect(input?.dispatch).toBe("waves");
  });

  it("computes nothing while a level, the field or the army is missing: never 0 assumed", () => {
    expect(planInput({ ...form, levels: { ...form.levels, cochineal: null } })).toBeNull();
    expect(planInput({ ...form, launchField: null })).toBeNull();
    expect(baseInput({ ...form, army: { JSN: 0 } })).toBeNull();
    expect(missingEntries(emptyHuntForm())).toEqual(["vos niveaux", "votre TDC", "l'armée envoyée"]);
    expect(missingEntries(form)).toEqual([]);
  });
});

describe("layingSpeed", () => {
  it("is 0.9 per level of Couveuse, Solarium and Technique de ponte, unknown while one is missing", () => {
    expect(layingSpeed({ nursery: 1, solarium: 1, laying: 0 })).toBeCloseTo(0.81);
    expect(layingSpeed({ nursery: 1, solarium: null, laying: 0 })).toBeNull();
  });
});

describe("chainDrafts", () => {
  it("fights each hunt at the field the previous ones leave", () => {
    expect(
      chainDrafts(1000, [
        { amount: 100, army: [5] },
        { amount: 80, army: [3] },
      ]),
    ).toEqual([
      { amount: 100, field: 1000, army: [5] },
      { amount: 80, field: 1100, army: [3] },
    ]);
  });
});
