import { svgElement } from "./html";

/** Marks every button Optizzz adds to the game's top bar, to place the next one left of them. */
const BAR_BUTTON_ATTRIBUTE = "data-optizzz-bar-button";
const BUTTON_WIDTH_PX = 45;

export interface MenuBarButton {
  className: string;
  /** Tooltip. */
  title: string;
  /** Accessible name. */
  label: string;
  /** Static SVG markup, drawn in `currentColor`. */
  icon: string;
  onClick: () => void;
}

/**
 * Adds an icon button to the game's top bar, left of the log-out button (`#boutonDeconnexion`, absolutely placed in the
 * bar's right margin) and of the buttons Optizzz already put there. Returns it, or undefined when the bar is missing or
 * the button is already there.
 */
export function insertMenuBarButton(doc: Document, spec: MenuBarButton): HTMLButtonElement | undefined {
  const menu = doc.querySelector<HTMLElement>("nav#menu");
  const tabs = doc.querySelector<HTMLElement>("#menu_horizontal");
  const logOut = doc.querySelector<HTMLElement>("#boutonDeconnexion");
  if (!menu || !tabs || !logOut || menu.querySelector(`.${spec.className}`)) return undefined;

  const ours = menu.querySelectorAll(`[${BAR_BUTTON_ATTRIBUTE}]`).length;
  const button = doc.createElement("button");
  button.type = "button";
  button.className = spec.className;
  button.setAttribute(BAR_BUTTON_ATTRIBUTE, "");
  button.title = spec.title;
  button.setAttribute("aria-label", spec.label);
  button.append(svgElement(doc, spec.icon));
  Object.assign(button.style, {
    position: "absolute",
    top: "0",
    right: `${String(BUTTON_WIDTH_PX * (ours + 1))}px`,
    width: `${String(BUTTON_WIDTH_PX)}px`,
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0",
    border: "none",
    background: "none",
    color: "var(--optizzz-menu-text)",
    cursor: "pointer",
  });
  button.addEventListener("click", spec.onClick);

  // Make room: the tabs keep the margin already there (log-out button, our other buttons) plus this one.
  const margin =
    Number.parseFloat(doc.defaultView?.getComputedStyle(tabs).marginRight ?? "") || BUTTON_WIDTH_PX * (ours + 1);
  tabs.style.marginRight = `${String(margin + BUTTON_WIDTH_PX)}px`;
  // In the DOM, left to right as on screen.
  (menu.querySelector<HTMLElement>(`[${BAR_BUTTON_ATTRIBUTE}]`) ?? logOut).before(button);
  return button;
}
