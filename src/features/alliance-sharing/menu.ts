import { addAllianceMenuEntry, addColonyMenuEntry } from "@/utils/alliance-menu";
import type { Feature } from "../feature";

export const SHARING_HASH = "#partage";
export const SHARING_LINK = `alliance.php?Membres${SHARING_HASH}`;
export const MY_STATE_HASH = "#etat";
export const MY_STATE_LINK = `fourmiliere.php${MY_STATE_HASH}`;

// Two arrows passing each other, drawn in the link colour like the game's sprite icons.
const SHARING_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>`;

// A clipboard.
const MY_STATE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
  <path d="M9 12h6"/><path d="M9 16h6"/></svg>`;

/** Adds « Mon état » to the Fourmilière menu and « Partage » to the alliance menu. */
export const allianceSharingMenu: Feature = {
  id: "alliance-sharing-menu",
  toggle: "alliance-sharing",
  matches: () => true,
  run() {
    addColonyMenuEntry(document, {
      className: "optizzz-my-state",
      href: MY_STATE_LINK,
      label: "Mon état",
      icon: MY_STATE_ICON,
    });
    addAllianceMenuEntry(document, {
      className: "optizzz-alliance-sharing",
      href: SHARING_LINK,
      label: "Partage",
      icon: SHARING_ICON,
    });
  },
};
