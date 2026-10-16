import { loadStoredIncome } from "@/data/income";
import { loadLevelsOf } from "@/data/levels";
import { readLoggedInPseudo } from "@/game/pages/alliance";
import { readProfile, readProfileState } from "@/game/pages/scores";
import { colonyTaxRate } from "@/game/production";
import type { Feature } from "../feature";
import { mountProductionRow, PRODUCTION_STYLE, type ColonyTax } from "./mount";

/** The tax of the profile shown, when Optizzz can know it: mine (Ressources.php) or one of my colonies'. */
async function colonyTax(pseudo: string, master: string | null): Promise<ColonyTax> {
  if (master === null) return { kind: "none" };
  const me = readLoggedInPseudo(document);
  if (pseudo === me) {
    const rate = (await loadStoredIncome(location.origin))?.taxRate;
    if (rate) return { kind: "known", rate };
  }
  if (master === me) {
    const levels = await loadLevelsOf(location.origin, ["aphids"]).catch(() => null);
    if (levels) return { kind: "known", rate: colonyTaxRate(levels.aphids) };
  }
  return { kind: "atLeast" };
}

/**
 * « Production max » on Membre.php: what the player's TDC harvests a day with every worker it can employ, after the
 * colony tax. See docs/features/production-profil.md.
 */
export const profileProduction: Feature = {
  id: "profile-production",
  toggle: "profile-production",
  matches: (url) => url.pathname.toLowerCase() === "/membre.php",
  async run() {
    const profile = readProfile(document);
    const state = readProfileState(document);
    const field = profile?.scores.field;
    if (!profile || !state || field === undefined) return;
    const style = document.createElement("style");
    style.textContent = PRODUCTION_STYLE;
    document.head.append(style);
    // Shown at once with the floor of the tax, refined if the exact rate can be read.
    if (state.master !== null) mountProductionRow(document, field, { kind: "atLeast" });
    mountProductionRow(document, field, await colonyTax(profile.pseudo, state.master));
  },
};
