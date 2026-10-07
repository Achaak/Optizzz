import { describe, expect, it, vi } from "vitest";
import { BUTTON_CLASS, insertSettingsButton } from "./menu-button";

// Structure observed on s5.fourmizzz.fr on 2026-10-07 (any page).
const MENU = `
<nav id="menu">
  <ul id="menu_horizontal" style="margin-right: 45px">
    <li><a id="boutonFourmiliere" href="Reine.php"><span></span>Fourmilière</a></li>
    <li><a id="boutonAide" href="tutorial.php"><span></span>Aide</a></li>
  </ul>
  <a id="boutonDeconnexion" href="deconnexion.php"><span></span></a>
</nav>`;

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");

describe("insertSettingsButton", () => {
  it("adds a button before the log-out button and widens the bar's margin", () => {
    const doc = parse(MENU);
    const onClick = vi.fn();
    const button = insertSettingsButton(doc, onClick);

    expect(button?.nextElementSibling?.id).toBe("boutonDeconnexion");
    expect(doc.querySelector<HTMLElement>("#menu_horizontal")?.style.marginRight).toBe("90px");
    button?.click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("adds it only once", () => {
    const doc = parse(MENU);
    insertSettingsButton(doc, vi.fn());
    expect(insertSettingsButton(doc, vi.fn())).toBeUndefined();
    expect(doc.querySelectorAll(`.${BUTTON_CLASS}`)).toHaveLength(1);
  });

  it("does nothing without the game's menu", () => {
    expect(insertSettingsButton(parse("<p>Connexion</p>"), vi.fn())).toBeUndefined();
  });
});
