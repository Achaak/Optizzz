import { svgElement } from "@/utils/html";

/** Styles of « Outils », shared by the in-game dialog and the toolbar popup. */
export const TOOLS_STYLE = `
.tools { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--optizzz-space-4); }
/* The whole row opens the tool, as a stat tile picks a metric (button.optizzz-stat). */
.tools button {
  display: grid; grid-template-columns: 1fr auto; align-items: center; gap: var(--optizzz-space-1) var(--optizzz-space-5);
  width: 100%; padding: var(--optizzz-space-4) var(--optizzz-space-5); text-align: left;
  background: var(--optizzz-surface-raised); border: 1px solid var(--optizzz-border-soft); border-radius: var(--optizzz-radius);
  filter: none;
}
.tools button:hover { background: var(--optizzz-surface-tint); border-color: var(--optizzz-border); }
.tools button:hover .tool-name { text-decoration: underline; }
.tool-name { font-weight: bold; color: var(--optizzz-link); }
.tool-description { grid-column: 1; color: var(--optizzz-text-muted); font-size: var(--optizzz-font-size-small); }
.tools svg { grid-column: 2; grid-row: 1 / span 2; width: 16px; height: 16px; color: var(--optizzz-text-muted); }`;

// An arrow drawn with the gear's stroke (menu-button.ts): the row opens something.
const ARROW_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>`;

export interface ToolsInput {
  /** Opens the combat simulator: over the game, or in a new tab from the toolbar popup. */
  openSimulator: () => void;
  /** Opens the server map: over the game, or in a new tab from the toolbar popup. */
  openServerMap: () => void;
  /** Opens « Suivis »: over the game, or in a new tab from the toolbar popup. */
  openWatchlist: () => void;
}

/** « Outils » : the extension's own pages. */
export function buildToolsSection(doc: Document, tools: ToolsInput): HTMLElement {
  const list = doc.createElement("ul");
  list.className = "tools";
  const tool = (label: string, text: string, onClick: () => void) => {
    const item = doc.createElement("li");
    const button = doc.createElement("button");
    button.type = "button";
    const name = doc.createElement("span");
    name.className = "tool-name";
    name.textContent = label;
    const description = doc.createElement("span");
    description.className = "tool-description";
    description.textContent = text;
    button.append(name, description, svgElement(doc, ARROW_ICON));
    button.addEventListener("click", onClick);
    item.append(button);
    return item;
  };
  list.append(
    tool(
      "Simulateur de combat",
      "Deux armées, un lieu : vainqueur, pertes, riposte, TDC et pillage.",
      tools.openSimulator,
    ),
    tool(
      "Carte du serveur",
      "Situer des joueurs et des alliances sur tout le serveur, avec distances et trajets.",
      tools.openServerMap,
    ),
    tool(
      "Suivis",
      "Les joueurs et alliances que vous suivez : leur terrain, leurs pertes et leurs changements.",
      tools.openWatchlist,
    ),
  );
  return list;
}
