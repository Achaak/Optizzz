import { readAllianceTag } from "@/game/pages/alliance";
import { addAllianceMenuEntry } from "@/utils/alliance-menu";
import type { Feature } from "../feature";
import { isEnabled } from "../toggles";

export const STATS_HASH = "#stats";
export const STATS_LINK = `alliance.php?Membres${STATS_HASH}`;

// Three bars, drawn in the link colour like the game's sprite icons.
const STATS_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M3 21h18"/><path d="M6 21V11"/><path d="M12 21V5"/><path d="M18 21v-7"/></svg>`;

/** Adds a « Statistiques » entry to the alliance menu, after « Progression », for a player in an alliance. */
export const allianceStatsMenu: Feature = {
  id: "alliance-stats-menu",
  toggle: "alliance-stats",
  matches: () => true,
  run(_ctx, toggles) {
    if (!isEnabled(toggles, "alliance-stats", "alliance") || !readAllianceTag(document)) return;
    addAllianceMenuEntry(document, {
      className: "optizzz-alliance-stats",
      href: STATS_LINK,
      label: "Statistiques",
      icon: STATS_ICON,
    });
  },
};
