import { describe, expect, it, vi } from "vitest";
import armeeMoveHtml from "@/data/__fixtures__/armee-move.html?raw";
import type { ProbesResult } from "@/data/probes";
import { armyFromKeys } from "@/game/army/units";
import { PLACES } from "@/game/probes";
import { renderProbes } from "./mount";

const parse = () => new DOMParser().parseFromString(armeeMoveHtml, "text/html");

const setup = (
  armies = { field: armyFromKeys({ JSN: 1500 }), nest: armyFromKeys({ JSN: 2 }), lodge: armyFromKeys({}) },
  result: ProbesResult = { placed: ["lodge"], missing: [], failed: false },
) => {
  const doc = parse();
  const place = vi.fn(() => Promise.resolve(result));
  const reload = vi.fn();
  renderProbes(doc, armies, PLACES, place, reload);
  const box = doc.querySelector(".optizzz-probes");
  return { doc, box, place, reload, button: box?.querySelector("button") };
};

describe("renderProbes", () => {
  it("warns above the garrison and says which ant would move where", () => {
    const { box, button } = setup();
    expect(box?.nextElementSibling?.textContent).toContain("Troupes en Garnison");
    expect(box?.textContent).toContain("Pas de sonde sur la Loge");
    expect(button?.textContent).toBe("Placer la sonde");
    expect(box?.querySelector(".optizzz-probes-moves")?.textContent).toBe(" 1 JSN du Terrain de chasse vers la Loge");
  });

  it("places the probes on click, then reloads the page", async () => {
    const { button, place, reload } = setup();
    button?.click();
    expect(button?.disabled).toBe(true);
    await vi.waitFor(() => {
      expect(reload).toHaveBeenCalled();
    });
    expect(place).toHaveBeenCalledOnce();
  });

  it("says so when the game does not take the move", async () => {
    const { box, reload, button } = setup(undefined, { placed: [], missing: ["lodge"], failed: true });
    button?.click();
    await vi.waitFor(() => {
      expect(box?.textContent).toContain("Le jeu n'a pas pris le déplacement");
    });
    expect(reload).not.toHaveBeenCalled();
  });

  it("says when too few ants are home, without a button", () => {
    const { box, button } = setup({ field: armyFromKeys({ JSN: 1 }), nest: armyFromKeys({}), lodge: armyFromKeys({}) });
    expect(box?.textContent).toContain("Pas de sonde sur le Dôme et la Loge");
    expect(box?.textContent).toContain("Pas assez de fourmis à la maison pour une sonde sur le Dôme et la Loge");
    expect(button).toBeNull();
  });

  it("shows nothing when every probe is in place", () => {
    const { box } = setup({
      field: armyFromKeys({ JSN: 9 }),
      nest: armyFromKeys({ JSN: 1 }),
      lodge: armyFromKeys({ Tk: 1 }),
    });
    expect(box).toBeNull();
  });
});
