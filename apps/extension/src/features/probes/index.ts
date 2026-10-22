import { readGarrison } from "@/data/garrison";
import {
  loadProbeTargets,
  markProbesPending,
  placeProbes,
  probePlan,
  saveProbeTargets,
  storeArmy,
  takeProbesPending,
} from "@/data/probes";
import type { ProbePlan } from "@optizzz/game/probes";
import type { Feature } from "../feature";
import { isEnabled, type Toggles } from "../toggles";
import { PROBES_STYLE, renderProbes } from "./mount";

/** What each place keeps on this server, as the player set it on Armée; nothing while the feature is off. */
export async function loadProbePlan(toggles: Toggles): Promise<ProbePlan> {
  return isEnabled(toggles, "probes") ? probePlan(await loadProbeTargets(location.host, toggles)) : {};
}

/**
 * Ants kept on each place, as many of each unit as the player chose. On Armee.php: the probes, a button when some
 * are missing, and their settings. After an attack sent from the game's form: the probes put back on the next
 * page (the hunt launcher does it itself). See docs/features/sondes.md.
 */
export const probes: Feature = {
  id: "probes",
  toggle: "probes",
  // Every page: the game may land anywhere after an attack is sent.
  matches: () => true,
  async run(_ctx, toggles) {
    const origin = location.origin;
    const path = location.pathname.toLowerCase();

    if (path === "/ennemie.php") {
      document.getElementById("formulaireChoixArmee")?.addEventListener("submit", () => {
        markProbesPending(sessionStorage);
      });
    }

    const targets = await loadProbeTargets(location.host, toggles);
    const plan = probePlan(targets);
    if (takeProbesPending(sessionStorage) && Object.keys(plan).length > 0) {
      const result = await placeProbes(origin, plan);
      // The garrison shown is the one before the moves.
      if (path === "/armee.php" && result.placed.length > 0) {
        location.reload();
        return;
      }
    }

    const garrison = path === "/armee.php" ? readGarrison(document) : null;
    if (!garrison) return;
    const style = document.createElement("style");
    style.textContent = PROBES_STYLE;
    document.head.append(style);
    renderProbes(document, {
      armies: garrison.armies,
      targets,
      place: () => placeProbes(origin, plan),
      store: () => storeArmy(origin, plan),
      save: (next) => saveProbeTargets(location.host, next),
      reload: () => {
        location.reload();
      },
    });
  },
};
