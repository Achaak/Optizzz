import { describe, expect, it } from "vitest";
import { countsToArmy } from "@optizzz/game/army/army-text";
import { armyFromKeys } from "@optizzz/game/army/units";
import { chainDrafts, planInput } from "@optizzz/game/hunt/hunt-form";
import { describeHunt, planHunts, summarize, type PlanInput } from "@optizzz/game/hunt/planner";
import { huntLinkFormat } from "@optizzz/game/site-links/hunt";
import { DEFAULT_SETTINGS } from "./settings";
import { siteState, type LauncherEntries } from "./site-link";

const levels = { weapons: 4, shield: 4, huntSpeed: 3, cochineal: 1 };
const entries: LauncherEntries = {
  army: armyFromKeys({ JSN: 2112, SN: 146, S: 40 }),
  levels,
  launchField: 4496,
  arrivalField: 4630,
  ongoing: 1,
  settings: { ...DEFAULT_SETTINGS, ratio: 7, dispatch: "waves", advanced: true },
  huntCount: null,
  huntAmount: null,
  override: null,
};

/** The input HuntLauncher builds from the same entries. */
const launcherInput = (e: LauncherEntries): PlanInput => {
  const slots = Math.max(0, e.levels.huntSpeed + 1 - e.ongoing);
  return {
    army: e.army,
    field: e.arrivalField,
    fieldAtLaunch: e.launchField,
    slots,
    levels: e.levels,
    ...(e.huntCount === null ? {} : { huntCount: Math.min(e.huntCount, Math.max(1, slots)) }),
    objective: { kind: "ratio", ratio: e.settings.ratio },
    dispatch: e.settings.dispatch,
    ...(e.huntAmount === null ? {} : { huntAmount: e.huntAmount }),
  };
};

const fast = { searchSamples: 200, finalSamples: 400 };

describe("siteState", { timeout: 20_000 }, () => {
  it("gives optizzz.fr the same engine input, hence the same plan", () => {
    const read = huntLinkFormat.decode(siteState(entries));
    expect(read?.advanced).toBe(true);
    const input = read && planInput(read.form);
    expect(input).toEqual(launcherInput(entries));
    expect(input && planHunts({ ...input, ...fast })).toEqual(planHunts({ ...launcherInput(entries), ...fast }));
  });

  it("keeps a forced count and surface, and the « Rendement » objective", () => {
    const forced: LauncherEntries = {
      ...entries,
      settings: { ...entries.settings, objective: "yield", maxLossShare: 0.02 },
      huntCount: 9,
      huntAmount: 60,
    };
    const read = huntLinkFormat.decode(siteState(forced));
    expect(read && planInput(read.form)).toEqual({
      ...launcherInput(forced),
      objective: { kind: "yield", maxLossShare: 0.02 },
    });
  });

  it("gives the hunts changed by hand, fought at the same fields", () => {
    const input = launcherInput(entries);
    const override = summarize(
      chainDrafts(input.field, [
        { amount: 90, army: armyFromKeys({ JSN: 1000, S: 40 }) },
        { amount: 70, army: armyFromKeys({ JSN: 1112, SN: 146 }) },
      ]).map((draft) => describeHunt({ ...input, ...fast }, draft)),
    );
    const read = huntLinkFormat.decode(siteState({ ...entries, override }));
    const edited = read?.form.edited ?? [];
    const drafts = chainDrafts(
      input.field,
      edited.map((hunt) => ({ amount: hunt.amount, army: countsToArmy(hunt.army) })),
    );
    expect(summarize(drafts.map((draft) => describeHunt({ ...input, ...fast }, draft)))).toEqual(override);
  });
});
