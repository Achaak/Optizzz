export const BUTTON_CLASS = "optizzz-settings-button";
const BUTTON_WIDTH_PX = 45;

// Gear, drawn in the menu's link colour like the game's sprite icons.
const GEAR_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;

/**
 * Adds an Optizzz button to the game's top bar, left of the log-out button
 * (`#boutonDeconnexion`, absolutely placed in the bar's right margin). Returns it, or
 * undefined when the bar is missing or the button is already there.
 */
export function insertSettingsButton(doc: Document, onClick: () => void): HTMLButtonElement | undefined {
  const menu = doc.querySelector<HTMLElement>("nav#menu");
  const tabs = doc.querySelector<HTMLElement>("#menu_horizontal");
  const logOut = doc.querySelector<HTMLElement>("#boutonDeconnexion");
  if (!menu || !tabs || !logOut || menu.querySelector(`.${BUTTON_CLASS}`)) return undefined;

  const button = doc.createElement("button");
  button.type = "button";
  button.className = BUTTON_CLASS;
  button.title = "Optizzz";
  button.setAttribute("aria-label", "Optizzz : à propos et paramètres");
  button.innerHTML = GEAR_ICON;
  Object.assign(button.style, {
    position: "absolute",
    top: "0",
    right: `${BUTTON_WIDTH_PX}px`,
    width: `${BUTTON_WIDTH_PX}px`,
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0",
    border: "none",
    background: "none",
    color: "rgb(211, 217, 184)",
    cursor: "pointer",
  });
  button.addEventListener("click", onClick);

  // Make room: the tabs keep the log-out button's margin plus ours.
  const margin = Number.parseFloat(doc.defaultView?.getComputedStyle(tabs).marginRight ?? "") || BUTTON_WIDTH_PX;
  tabs.style.marginRight = `${margin + BUTTON_WIDTH_PX}px`;
  logOut.before(button);
  return button;
}
