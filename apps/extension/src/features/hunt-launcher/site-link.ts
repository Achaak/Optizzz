// « Ouvrir sur optizzz.fr » and « Copier le lien » of the hunt launcher: its entries as the site's hunt simulator keeps
// them, which asks the engine the same plan (planInput). See docs/features/site-chasse.md.
import { armyToCounts } from "@optizzz/game/army/army-text";
import type { Army, Levels } from "@optizzz/game/army/units";
import { emptyHuntForm, type HuntForm } from "@optizzz/game/hunt/hunt-form";
import type { Plan } from "@optizzz/game/hunt/planner";
import { huntLinkFormat } from "@optizzz/game/site-links/hunt";
import type { Settings } from "./settings";

export interface LauncherEntries {
  /** The army the plan is computed for: reserve and anti-probes already kept home. */
  army: Army;
  levels: Levels;
  launchField: number;
  arrivalField: number;
  /** Hunts away: their slots are taken. */
  ongoing: number;
  settings: Pick<Settings, "objective" | "ratio" | "maxLossShare" | "dispatch" | "advanced">;
  huntCount: number | null;
  huntAmount: number | null;
  /** The hunts changed by hand, null for the plan computed. */
  override: Plan | null;
}

/** The launcher's entries in the site's form. The laying levels stay empty: the launcher only knows the speed. */
function launcherForm(entries: LauncherEntries): HuntForm {
  const { settings } = entries;
  return {
    ...emptyHuntForm(),
    army: armyToCounts(entries.army),
    levels: { ...entries.levels },
    launchField: entries.launchField,
    arrivalField: entries.arrivalField,
    takenSlots: entries.ongoing,
    objective: settings.objective,
    ratio: settings.ratio,
    maxLossShare: settings.maxLossShare,
    dispatch: settings.dispatch,
    huntCount: entries.huntCount,
    huntAmount: entries.huntAmount,
    edited: entries.override?.hunts.map((hunt) => ({ amount: hunt.amount, army: armyToCounts(hunt.army) })) ?? null,
  };
}

/** The encoded state for the site's hunt simulator. */
export const siteState = (entries: LauncherEntries): string =>
  huntLinkFormat.encode({ form: launcherForm(entries), advanced: entries.settings.advanced });
