import { readGarrison } from "@/data/garrison";
import { markProbesPending, placeProbes, takeProbesPending } from "@/data/probes";
import type { Place } from "@/game/army/battle";
import type { Feature } from "../feature";
import { isEnabled, type Toggles } from "../toggles";
import { PROBES_STYLE, renderProbes } from "./mount";

/** The places that must keep a probe: one option per place under « Sondes ». */
export const watchedPlaces = (toggles: Toggles): Place[] => [
  ...(isEnabled(toggles, "probes", "field") ? (["field"] as const) : []),
  ...(isEnabled(toggles, "probes", "nest") ? (["nest"] as const) : []),
  ...(isEnabled(toggles, "probes", "lodge") ? (["lodge"] as const) : []),
];

/**
 * An ant kept on each watched place. On Armee.php: a warning and a button when one is missing. After an attack sent
 * from the game's form: the probes put back on the next page (the hunt launcher does it itself). See
 * docs/features/sondes.md.
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

    if (takeProbesPending(sessionStorage)) {
      const result = await placeProbes(origin, watched);
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
    renderProbes(
      document,
      garrison.armies,
      watched,
      () => placeProbes(origin, watched),
      () => {
        location.reload();
      },
    );
  },
};
