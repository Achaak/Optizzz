import { svgElement } from "@/utils/html";
import type { Feature } from "../feature";

export const CHAIN_HASH = "#chaine";
export const CHAIN_LINK = `alliance.php?Membres${CHAIN_HASH}`;

// Chain links, drawn in the link colour like the game's sprite icons.
const CHAIN_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;

/** Adds a « Chaîne » entry to the alliance menu, after « Carte » (or « Membres » when the map is off). */
export const tdcChainMenu: Feature = {
  id: "tdc-chain-menu",
  toggle: "tdc-chain",
  matches: () => true,
  run() {
    const menu = document.querySelector("#menuAlliance");
    const after = (menu?.querySelector(".optizzz-alliance-map") ?? menu?.querySelector("a.boutonMembres"))?.closest(
      "li",
    );
    if (!after || menu?.querySelector(".optizzz-tdc-chain")) return;

    const icon = document.createElement("span");
    icon.append(svgElement(document, CHAIN_ICON));
    icon.style.background = "none";
    icon.style.display = "flex";
    icon.style.alignItems = "center";
    icon.style.justifyContent = "center";

    const link = document.createElement("a");
    link.className = "optizzz-tdc-chain";
    link.href = CHAIN_LINK;
    link.append(icon, "Chaîne");

    const item = document.createElement("li");
    item.append(link);
    after.after(item);
  },
};
