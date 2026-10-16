import { svgElement } from "./html";

/** Marks every button Optizzz adds to the game's top bar (the game look styles their hover). */
const BAR_BUTTON_ATTRIBUTE = "data-optizzz-bar-button";
const BAR_CLASS = "optizzz-bar";
const ITEMS_CLASS = "optizzz-bar-items";
const MORE_CLASS = "optizzz-bar-more";
const LABEL_CLASS = "optizzz-bar-label";
const OPEN_ATTRIBUTE = "data-open";
const BUTTON_WIDTH_PX = 45;
/** The game's phone breakpoint (design7.css): the tabs already shrink there, so our buttons fold into one. */
const PHONE = "(max-width: 41em)";

// Three dots: the button that unfolds Optizzz's buttons on a phone.
const MORE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"
  aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>`;

export interface MenuBarButton {
  className: string;
  /** Tooltip. */
  title: string;
  /** Accessible name, and the text shown next to the icon in the phone's drop-down. */
  label: string;
  /** Static SVG markup, drawn in `currentColor`. */
  icon: string;
  onClick: () => void;
}

/**
 * Adds an icon button to the game's top bar, left of the log-out button (`#boutonDeconnexion`, absolutely placed in the
 * bar's right margin) and of the buttons Optizzz already put there. On a phone, Optizzz's buttons fold into a single
 * « … » button that drops them down with their labels. Returns the button, or undefined when the bar is missing or the
 * button is already there.
 */
export function insertMenuBarButton(doc: Document, spec: MenuBarButton): HTMLButtonElement | undefined {
  const menu = doc.querySelector<HTMLElement>("nav#menu");
  const tabs = doc.querySelector<HTMLElement>("#menu_horizontal");
  const logOut = doc.querySelector<HTMLElement>("#boutonDeconnexion");
  if (!menu || !tabs || !logOut || menu.querySelector(`.${spec.className}`)) return undefined;

  const bar = menu.querySelector<HTMLElement>(`.${BAR_CLASS}`) ?? insertBar(doc, tabs, logOut);
  const items = bar.querySelector<HTMLElement>(`.${ITEMS_CLASS}`);
  if (!items) return undefined;

  const button = doc.createElement("button");
  button.type = "button";
  button.className = spec.className;
  button.setAttribute(BAR_BUTTON_ATTRIBUTE, "");
  button.title = spec.title;
  button.setAttribute("aria-label", spec.label);
  const label = doc.createElement("span");
  label.className = LABEL_CLASS;
  label.textContent = spec.label;
  button.append(svgElement(doc, spec.icon), label);
  button.addEventListener("click", () => {
    bar.removeAttribute(OPEN_ATTRIBUTE);
    bar.querySelector(`.${MORE_CLASS}`)?.setAttribute("aria-expanded", "false");
    spec.onClick();
  });
  // Left to right as on screen: the newest goes left.
  items.prepend(button);

  // Make room on a wide screen: the log-out button plus each of ours. On a phone, the stylesheet keeps one slot.
  const count = items.childElementCount;
  tabs.style.marginRight = `${String(Number(bar.dataset.baseMargin) + BUTTON_WIDTH_PX * count)}px`;
  return button;
}

/** The bar's box for Optizzz's buttons, its « … » button and its stylesheet, left of the log-out button. */
function insertBar(doc: Document, tabs: HTMLElement, logOut: HTMLElement): HTMLElement {
  const baseMargin = Number.parseFloat(doc.defaultView?.getComputedStyle(tabs).marginRight ?? "") || BUTTON_WIDTH_PX;

  const bar = doc.createElement("div");
  bar.className = BAR_CLASS;
  bar.dataset.baseMargin = String(baseMargin);

  const style = doc.createElement("style");
  style.textContent = barStyle(baseMargin);

  const items = doc.createElement("div");
  items.className = ITEMS_CLASS;
  items.id = "optizzz-bar-items";

  const more = doc.createElement("button");
  more.type = "button";
  more.className = MORE_CLASS;
  more.setAttribute(BAR_BUTTON_ATTRIBUTE, "");
  more.title = "Outils Optizzz";
  more.setAttribute("aria-label", "Outils Optizzz");
  more.setAttribute("aria-expanded", "false");
  more.setAttribute("aria-controls", items.id);
  more.append(svgElement(doc, MORE_ICON));

  const setOpen = (open: boolean) => {
    bar.toggleAttribute(OPEN_ATTRIBUTE, open);
    more.setAttribute("aria-expanded", String(open));
  };
  more.addEventListener("click", () => {
    setOpen(!bar.hasAttribute(OPEN_ATTRIBUTE));
  });
  doc.addEventListener("click", (event) => {
    if (event.target instanceof Node && !bar.contains(event.target)) setOpen(false);
  });
  doc.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && bar.hasAttribute(OPEN_ATTRIBUTE)) {
      setOpen(false);
      more.focus();
    }
  });

  bar.append(style, more, items);
  logOut.before(bar);
  return bar;
}

function barStyle(baseMargin: number): string {
  return `
nav#menu .${BAR_CLASS} {
  position: absolute;
  top: 0;
  right: ${String(BUTTON_WIDTH_PX)}px;
  height: 100%;
  display: flex;
}
nav#menu .${ITEMS_CLASS} {
  display: flex;
  height: 100%;
}
nav#menu .${BAR_CLASS} button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: ${String(BUTTON_WIDTH_PX)}px;
  height: 100%;
  padding: 0;
  border: none;
  background: none;
  color: var(--optizzz-menu-text);
  font: inherit;
  cursor: pointer;
}
nav#menu .${BAR_CLASS} button svg {
  flex: none;
}
/* Wide screen: no « … », no labels. Same specificity as the phone's rules below, which come later. */
nav#menu .${BAR_CLASS} :is(button.${MORE_CLASS}, span.${LABEL_CLASS}) {
  display: none;
}
@media screen and ${PHONE} {
  nav#menu ul#menu_horizontal {
    margin-right: ${String(baseMargin + BUTTON_WIDTH_PX)}px !important;
  }
  nav#menu .${BAR_CLASS} button.${MORE_CLASS} {
    display: flex;
  }
  nav#menu .${ITEMS_CLASS} {
    display: none;
    position: absolute;
    top: 100%;
    right: 0;
    flex-direction: column;
    height: auto;
    width: max-content;
    padding: 4px 0;
    background: var(--optizzz-menu-bg);
    border-radius: 0 0 var(--optizzz-radius) var(--optizzz-radius);
    box-shadow: var(--optizzz-shadow);
  }
  nav#menu .${BAR_CLASS}[${OPEN_ATTRIBUTE}] .${ITEMS_CLASS} {
    display: flex;
  }
  nav#menu .${ITEMS_CLASS} button {
    justify-content: flex-start;
    width: 100%;
    height: 44px;
    padding: 0 16px;
    white-space: nowrap;
  }
  nav#menu .${BAR_CLASS} span.${LABEL_CLASS} {
    display: inline;
  }
}`;
}
