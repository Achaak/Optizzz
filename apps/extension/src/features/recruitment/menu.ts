import { addAllianceMenuEntry } from "@/utils/alliance-menu";
import type { Feature } from "../feature";

export const RECRUITMENT_HASH = "#recrutement";
const RECRUITMENT_LINK = `alliance.php?Membres${RECRUITMENT_HASH}`;

// A person and a plus, drawn in the link colour like the game's sprite icons.
const RECRUITMENT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M19 8v6M16 11h6"/></svg>`;

/** Adds a « Recrutement » entry to the alliance menu. See docs/features/recrutement.md. */
export const recruitmentMenu: Feature = {
  id: "recruitment-menu",
  toggle: "recruitment",
  matches: () => true,
  run() {
    addAllianceMenuEntry(document, {
      className: "optizzz-recruitment",
      href: RECRUITMENT_LINK,
      label: "Recrutement",
      icon: RECRUITMENT_ICON,
    });
  },
};
