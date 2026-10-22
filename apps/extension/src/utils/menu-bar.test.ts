import { describe, expect, it, vi } from "vitest";
import { insertMenuBarButton, type MenuBarButton } from "./menu-bar";

// Structure observed on s5.fourmizzz.fr on 2026-10-07 (any page).
const MENU = `
<nav id="menu">
  <ul id="menu_horizontal" style="margin-right: 45px">
    <li><a id="boutonFourmiliere" href="Reine.php"><span></span>Fourmilière</a></li>
  </ul>
  <a id="boutonDeconnexion" href="deconnexion.php"><span></span></a>
</nav>`;

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");
const spec = (className: string): MenuBarButton => ({
  className,
  title: className,
  label: `Ouvrir ${className}`,
  icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/></svg>`,
  onClick: vi.fn(),
});
const more = (doc: Document) => doc.querySelector<HTMLButtonElement>(".optizzz-menu-bar-more");
const bar = (doc: Document) => doc.querySelector<HTMLElement>(".optizzz-menu-bar");

describe("insertMenuBarButton", () => {
  it("puts each new button left of the ones Optizzz already added, and widens the bar's margin each time", () => {
    const doc = parse(MENU);
    const first = insertMenuBarButton(doc, spec("first"));
    const second = insertMenuBarButton(doc, spec("second"));

    expect(second?.nextElementSibling).toBe(first);
    expect(bar(doc)?.nextElementSibling?.id).toBe("boutonDeconnexion");
    expect(doc.querySelector<HTMLElement>("#menu_horizontal")?.style.marginRight).toBe("135px");
  });

  it("keeps a single slot for the « … » button on a phone", () => {
    const doc = parse(MENU);
    insertMenuBarButton(doc, spec("first"));
    insertMenuBarButton(doc, spec("second"));

    expect(doc.querySelectorAll(".optizzz-menu-bar-more")).toHaveLength(1);
    expect(bar(doc)?.querySelector("style")?.textContent).toMatch(
      /@media screen and \(max-width: 41em\)[^]*margin-right: 90px !important/,
    );
  });

  it("labels each button for the phone's drop-down", () => {
    const doc = parse(MENU);
    expect(insertMenuBarButton(doc, spec("first"))?.textContent).toBe("Ouvrir first");
  });

  it("calls back on click and folds the drop-down", () => {
    const doc = parse(MENU);
    const button = spec("first");
    const inserted = insertMenuBarButton(doc, button);
    more(doc)?.click();
    expect(bar(doc)?.hasAttribute("data-open")).toBe(true);
    expect(more(doc)?.getAttribute("aria-expanded")).toBe("true");

    inserted?.click();
    expect(button.onClick).toHaveBeenCalledOnce();
    expect(bar(doc)?.hasAttribute("data-open")).toBe(false);
    expect(more(doc)?.getAttribute("aria-expanded")).toBe("false");
  });

  it("folds the drop-down on a click elsewhere", () => {
    const doc = parse(MENU);
    insertMenuBarButton(doc, spec("first"));
    more(doc)?.click();
    doc.querySelector<HTMLElement>("#boutonFourmiliere")?.click();
    expect(bar(doc)?.hasAttribute("data-open")).toBe(false);
  });
});
