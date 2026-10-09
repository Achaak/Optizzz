// Entries Optizzz adds to the game's menus (present on every page): the alliance menu, in a fixed order after
// « Membres », and the Fourmilière menu.
import { svgElement } from "./html";

/** Display order of the Optizzz entries; each one goes after those before it that are present. */
const ENTRY_ORDER = [
  "optizzz-alliance-map",
  "optizzz-tdc-chain",
  "optizzz-history",
  "optizzz-alliance-sharing",
] as const;

interface MenuEntry {
  className: string;
  href: string;
  label: string;
  /** SVG markup, drawn in the link colour like the game's sprite icons (24×26 box). */
  icon: string;
}

export interface AllianceMenuEntry extends MenuEntry {
  className: (typeof ENTRY_ORDER)[number];
}

/** Adds the entry once, after « Membres » and the Optizzz entries that come before it. */
export function addAllianceMenuEntry(doc: Document, entry: AllianceMenuEntry): void {
  const before = ENTRY_ORDER.slice(0, ENTRY_ORDER.indexOf(entry.className)).reverse();
  addMenuEntry(doc, "#menuAlliance", [...before.map((name) => `.${name}`), "a.boutonMembres"], entry);
}

/** Adds the entry once to the Fourmilière menu, after « Ma Fourmilière ». */
export function addColonyMenuEntry(doc: Document, entry: MenuEntry): void {
  addMenuEntry(doc, "#menuFourmiliere", ["a.boutonMaFourmiliere"], entry);
}

/** Adds the entry once, with the game's structure: <li><a><span>icon</span>Label</a></li>, after the first found. */
function addMenuEntry(doc: Document, menuSelector: string, afterSelectors: string[], entry: MenuEntry): void {
  const menu = doc.querySelector(menuSelector);
  if (!menu || menu.querySelector(`.${entry.className}`)) return;
  const after = afterSelectors
    .map((selector) => menu.querySelector(selector))
    .find((element) => element !== null)
    ?.closest("li");
  if (!after) return;

  const icon = doc.createElement("span");
  icon.append(svgElement(doc, entry.icon));
  icon.style.background = "none";
  icon.style.display = "flex";
  icon.style.alignItems = "center";
  icon.style.justifyContent = "center";

  const link = doc.createElement("a");
  link.className = entry.className;
  link.href = entry.href;
  link.append(icon, entry.label);

  const item = doc.createElement("li");
  item.append(link);
  after.after(item);
}
