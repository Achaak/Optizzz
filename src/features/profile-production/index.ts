import { loadPlayersExport } from "@/data/exports";
import { loadStoredIncome } from "@/data/income";
import { loadLevelsOf } from "@/data/levels";
import { readLoggedInPseudo } from "@/game/pages/alliance";
import { readProfile, readProfileState } from "@/game/pages/scores";
import { colonyTaxRate } from "@/game/production";
import type { Feature } from "../feature";
import { mountColoniesRow, mountProductionRow, PRODUCTION_STYLE, type Colony, type ColonyTax } from "./mount";

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
 * The colonies of the profile's player, from the last export, with the rate each pays when Optizzz knows it: all of
 * them on my own profile (my aphid stable), mine on my master's (Ressources.php).
 */
async function coloniesOf(pseudo: string): Promise<Colony[]> {
  const players = (await loadPlayersExport(location.origin)).players;
  const master = players.find((player) => player.pseudo === pseudo);
  if (!master) return [];
  const colonies = players.filter((player) => player.masterPlayerId === master.id);
  if (colonies.length === 0) return [];
  const me = readLoggedInPseudo(document);
  const stableRate =
    pseudo === me
      ? await loadLevelsOf(location.origin, ["aphids"]).then(
          (levels) => colonyTaxRate(levels.aphids),
          () => null,
        )
      : null;
  // A rate of 0 is a page read while I was free: not the rate I pay now.
  const storedRate = colonies.some((colony) => colony.pseudo === me)
    ? (await loadStoredIncome(location.origin))?.taxRate
    : undefined;
  const myRate = storedRate !== undefined && storedRate > 0 ? storedRate : null;
  return colonies.map((colony) => ({
    field: colony.field,
    rate: stableRate ?? (colony.pseudo === me ? myRate : null),
  }));
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
    try {
      mountColoniesRow(document, await coloniesOf(profile.pseudo));
    } catch (error) {
      console.warn("[Optizzz] profile production: colonies unknown", error);
    }
  },
};
