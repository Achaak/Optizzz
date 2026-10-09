import { addAllianceMenuEntry } from "@/utils/alliance-menu";
import type { Feature } from "../feature";
import { isEnabled } from "../toggles";

export const HISTORY_HASH = "#historique";
export const HISTORY_LINK = `alliance.php?Membres${HISTORY_HASH}`;

// A rising line, drawn in the link colour like the game's sprite icons.
const HISTORY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-7"/></svg>`;

/** Adds a « Historique » entry to the alliance menu, after the other Optizzz views (or « Membres »). */
export const historyMenu: Feature = {
  id: "history-menu",
  toggle: "history",
  matches: () => true,
  run(_ctx, toggles) {
    if (!isEnabled(toggles, "history", "alliance")) return;
    addAllianceMenuEntry(document, {
      className: "optizzz-history",
      href: HISTORY_LINK,
      label: "Historique",
      icon: HISTORY_ICON,
    });
  },
};
