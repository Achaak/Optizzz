/** Styles of « Outils », shared by the in-game dialog and the toolbar popup. */
export const TOOLS_STYLE = `
.tools { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
.tools button { font: inherit; font-weight: bold; cursor: pointer; }
.tool-description { margin: 2px 0 0; color: var(--optizzz-text-muted); font-size: var(--optizzz-font-size-small); }`;

export interface ToolsInput {
  /** Opens the combat simulator: over the game, or in a new tab from the toolbar popup. */
  openSimulator: () => void;
  /** Opens the server map: over the game, or in a new tab from the toolbar popup. */
  openServerMap: () => void;
}

/** « Outils » : the extension's own pages. */
export function buildToolsSection(doc: Document, tools: ToolsInput): HTMLElement {
  const list = doc.createElement("ul");
  list.className = "tools";
  const tool = (label: string, text: string, onClick: () => void) => {
    const item = doc.createElement("li");
    const button = doc.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", onClick);
    const description = doc.createElement("p");
    description.className = "tool-description";
    description.textContent = text;
    item.append(button, description);
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
  );
  return list;
}
