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
  label: className,
  icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/></svg>`,
  onClick: vi.fn(),
});

describe("insertMenuBarButton", () => {
  it("puts each new button left of the ones Optizzz already added, and widens the bar's margin each time", () => {
    const doc = parse(MENU);
    const first = insertMenuBarButton(doc, spec("first"));
    const second = insertMenuBarButton(doc, spec("second"));

    expect(first?.style.right).toBe("45px");
    expect(second?.style.right).toBe("90px");
    expect(second?.nextElementSibling).toBe(first);
    expect(first?.nextElementSibling?.id).toBe("boutonDeconnexion");
    expect(doc.querySelector<HTMLElement>("#menu_horizontal")?.style.marginRight).toBe("135px");
  });

  it("calls back on click", () => {
    const button = spec("first");
    insertMenuBarButton(parse(MENU), button)?.click();
    expect(button.onClick).toHaveBeenCalledOnce();
  });
});
