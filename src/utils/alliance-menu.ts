// Entries Optizzz adds to the alliance menu (present on every page), in a fixed order after « Membres ».
import { svgElement } from "./html";

/** Display order of the Optizzz entries; each one goes after those before it that are present. */
const ENTRY_ORDER = ["optizzz-alliance-map", "optizzz-tdc-chain", "optizzz-history"] as const;

export interface AllianceMenuEntry {
  className: (typeof ENTRY_ORDER)[number];
  href: string;
  label: string;
  /** SVG markup, drawn in the link colour like the game's sprite icons (24×26 box). */
  icon: string;
}

/** Adds the entry once, with the game's structure: <li><a><span>icon</span>Label</a></li>. */
export function addAllianceMenuEntry(doc: Document, entry: AllianceMenuEntry): void {
  const menu = doc.querySelector("#menuAlliance");
  if (!menu || menu.querySelector(`.${entry.className}`)) return;
  const before = ENTRY_ORDER.slice(0, ENTRY_ORDER.indexOf(entry.className)).reverse();
  const after = [...before.map((name) => `.${name}`), "a.boutonMembres"]
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
