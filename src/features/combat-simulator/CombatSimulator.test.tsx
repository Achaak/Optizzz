import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { armyFromKeys } from "@/game/army/units";
import { storeLevels } from "../game-levels/levels";
import { CombatSimulator } from "./CombatSimulator";
import { storeGarrison } from "./garrison";

// Smoke test of the page: it fills itself from what was remembered and shows a result. The look is checked by hand.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ORIGIN = "https://s5.fourmizzz.fr";
let container: HTMLElement;

beforeEach(async () => {
  fakeBrowser.reset();
  container = document.createElement("div");
  document.body.append(container);
  await storeGarrison(
    ORIGIN,
    {
      armies: { field: armyFromKeys({ JSN: 1000 }), nest: armyFromKeys({}), lodge: armyFromKeys({ JSN: 19 }) },
      dome: 2,
      lodge: 1,
      field: 4496,
    },
    new Date(2026, 9, 7, 18, 0),
  );
  await storeLevels(ORIGIN, { weapons: 4, shield: 4 });
});

afterEach(() => {
  container.remove();
});

async function render(side: "attack" | "defend") {
  const root = createRoot(container);
  await act(async () => {
    root.render(<CombatSimulator server="s5.fourmizzz.fr" side={side} />);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return root;
}

const valueOf = (label: string) => container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)?.value;

describe("CombatSimulator", () => {
  it("attacks with the remembered army: an empty hunting field is won", async () => {
    await render("attack");
    expect(valueOf("Jeune Soldate Naine")).toBe("1019");
    expect(valueOf("Armes")).toBe("4");
    expect(container.querySelector(".verdict")?.textContent).toContain("L'attaque réussit");
    expect(container.textContent).toContain("Règles non vérifiées");
  });

  it("defends with the remembered army, place by place", async () => {
    await render("defend");
    expect(valueOf("Jeune Soldate Naine, Terrain de chasse")).toBe("1000");
    expect(valueOf("Jeune Soldate Naine, Loge Impériale")).toBe("19");
    expect(valueOf("Dôme")).toBe("2");
    expect(container.textContent).toContain("Ajoutez des unités à l'attaquant.");
  });
});
