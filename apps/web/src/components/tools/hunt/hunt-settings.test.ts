import { armyFromKeys } from "@optizzz/game/army/units";
import { emptyHuntForm } from "@optizzz/game/hunt/hunt-form";
import type { Plan } from "@optizzz/game/hunt/planner";
import { describe, expect, it } from "vitest";
import { advancedSettings, editHunt, withLevels } from "./hunt-settings";

describe("« Mes niveaux » in the hunt simulator", () => {
  it("fill the four hunt levels and the three laying levels", () => {
    const mine = { weapons: 12, shield: 11, huntSpeed: 6, cochineal: 3, nursery: 10, solarium: 9, laying: 4, dome: 2 };
    const form = withLevels(emptyHuntForm(), mine);
    expect(form.levels).toEqual({ weapons: 12, shield: 11, huntSpeed: 6, cochineal: 3 });
    expect(form.laying).toEqual({ nursery: 10, solarium: 9, laying: 4 });
  });

  it("leave a field alone when its level is not known", () => {
    const typed = { ...emptyHuntForm(), levels: { ...emptyHuntForm().levels, shield: 4 } };
    expect(withLevels(typed, { weapons: 2 }).levels).toEqual({
      weapons: 2,
      shield: 4,
      huntSpeed: null,
      cochineal: null,
    });
  });
});

describe("advancedSettings", () => {
  it("is empty for what the simple display shows", () => {
    expect(advancedSettings({ ...emptyHuntForm(), launchField: 500, arrivalField: 500 })).toEqual([]);
  });

  it("names each advanced setting in use", () => {
    expect(
      advancedSettings({
        ...emptyHuntForm(),
        launchField: 500,
        arrivalField: 600,
        takenSlots: 2,
        huntCount: 1,
        huntAmount: 12_000,
        edited: [],
      }),
    ).toEqual([
      "TdC à l'arrivée changé",
      "2 chasses déjà en cours",
      "1 chasse imposée",
      "12 000 cm² par chasse imposés",
      "chasses changées à la main",
    ]);
  });
});

describe("editHunt", () => {
  const plan = {
    hunts: [
      { amount: 100, army: armyFromKeys({ JSN: 500, SN: 20 }) },
      { amount: 100, army: armyFromKeys({ JSN: 600 }) },
    ],
  } as unknown as Plan;

  it("changes the surface of one hunt and keeps the others", () => {
    expect(editHunt(plan, 1, { amount: 80 })).toEqual([
      { amount: 100, army: { JSN: 500, SN: 20 } },
      { amount: 80, army: { JSN: 600 } },
    ]);
  });

  it("changes the count of one unit in one hunt", () => {
    expect(editHunt(plan, 0, { unit: "SN", count: 0 })[0]).toEqual({ amount: 100, army: { JSN: 500 } });
    expect(editHunt(plan, 1, { unit: "Tk", count: 3 })[1]).toEqual({ amount: 100, army: { JSN: 600, Tk: 3 } });
  });
});
