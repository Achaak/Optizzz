/** Styles of « Outils », shared by the in-game dialog and the toolbar popup. */
export const TOOLS_STYLE = `
.tools { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
.tools button { font: inherit; font-weight: bold; cursor: pointer; }
.tool-description { margin: 2px 0 0; color: var(--optizzz-text-muted); font-size: var(--optizzz-font-size-small); }`;

export interface ToolsInput {
  /** Opens the combat simulator in a new tab. */
  openSimulator: () => void;
}

/** « Outils » : the extension's own pages. */
export function buildToolsSection(doc: Document, tools: ToolsInput): HTMLElement {
  const list = doc.createElement("ul");
  list.className = "tools";
  const item = doc.createElement("li");
  const button = doc.createElement("button");
  button.type = "button";
  button.textContent = "Simulateur de combat";
  button.addEventListener("click", tools.openSimulator);
  const description = doc.createElement("p");
  description.className = "tool-description";
  description.textContent =
    "Deux armées, un lieu : vainqueur, pertes, riposte, TDC et pillage. S'ouvre dans un nouvel onglet.";
  item.append(button, description);
  list.append(item);
  return list;
}
