import { readGarrison } from "@/data/garrison";
import {
  loadProbeTargets,
  markProbesPending,
  placeProbes,
  probePlan,
  saveProbeTargets,
  takeProbesPending,
} from "@/data/probes";
import type { Place } from "@/game/army/battle";
import type { ProbePlan } from "@/game/probes";
import type { Feature } from "../feature";
import { isEnabled, type Toggles } from "../toggles";
import { PROBES_STYLE, renderProbes } from "./mount";

/** The places that must keep a probe: one option per place under « Sondes ». */
export const watchedPlaces = (toggles: Toggles): Place[] => [
  ...(isEnabled(toggles, "probes", "field") ? (["field"] as const) : []),
  ...(isEnabled(toggles, "probes", "nest") ? (["nest"] as const) : []),
  ...(isEnabled(toggles, "probes", "lodge") ? (["lodge"] as const) : []),
];

/** What each watched place keeps on this server, as the player set it on Armée. */
export async function loadProbePlan(toggles: Toggles): Promise<ProbePlan> {
  return probePlan(await loadProbeTargets(location.host), watchedPlaces(toggles));
}

/**
 * Ants kept on each watched place, as many of each unit as the player chose. On Armee.php: the probes, a button when
 * some are missing, and their settings. After an attack sent from the game's form: the probes put back on the next
 * page (the hunt launcher does it itself). See docs/features/sondes.md.
 */
export const probes: Feature = {
  id: "probes",
  toggle: "probes",
  // Every page: the game may land anywhere after an attack is sent.
  matches: () => true,
  async run(_ctx, toggles) {
    const watched = watchedPlaces(toggles);
    if (watched.length === 0) return;
    const origin = location.origin;
    const path = location.pathname.toLowerCase();

    if (path === "/ennemie.php") {
      document.getElementById("formulaireChoixArmee")?.addEventListener("submit", () => {
        markProbesPending(sessionStorage);
      });
    }

    const targets = await loadProbeTargets(location.host);
    if (takeProbesPending(sessionStorage)) {
      const result = await placeProbes(origin, probePlan(targets, watched));
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
      watched,
      targets,
      place: () => placeProbes(origin, probePlan(targets, watched)),
      save: (next) => saveProbeTargets(location.host, next),
      reload: () => {
        location.reload();
      },
    });
  },
};
