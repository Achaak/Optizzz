import { addAllianceMenuEntry } from "@/utils/alliance-menu";
import type { Feature } from "../feature";

export const MAP_HASH = "#carte";
export const MAP_LINK = `alliance.php?Membres${MAP_HASH}`;

// Folded map icon, drawn in the link colour like the game's sprite icons (24×26 box).
const MAP_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15"/><path d="M15 6v15"/></svg>`;

/** Adds a « Carte » entry to the alliance menu (present on every page), after « Membres ». */
export const allianceMapMenu: Feature = {
  id: "alliance-map-menu",
  toggle: "alliance-map",
  matches: () => true,
  run() {
    addAllianceMenuEntry(document, {
      className: "optizzz-alliance-map",
      href: MAP_LINK,
      label: "Carte",
      icon: MAP_ICON,
    });
  },
};
