import { describe, expect, it, vi } from "vitest";
import armeeMoveHtml from "@/data/__fixtures__/armee-move.html?raw";
import { DEFAULT_PROBE_TARGETS, type ProbesResult, type ProbeTargets } from "@/data/probes";
import type { Place } from "@/game/army/battle";
import { armyFromKeys } from "@/game/army/units";
import { PLACES } from "@/game/probes";
import { renderProbes } from "./mount";

const parse = () => new DOMParser().parseFromString(armeeMoveHtml, "text/html");

const setup = ({
  armies = { field: armyFromKeys({ JSN: 1500 }), nest: armyFromKeys({ JSN: 2 }), lodge: armyFromKeys({}) },
  targets = DEFAULT_PROBE_TARGETS,
  watched = PLACES,
  result = { placed: ["lodge"], missing: [], failed: false },
}: {
  armies?: Record<Place, number[]>;
  targets?: ProbeTargets;
  watched?: readonly Place[];
  result?: ProbesResult;
} = {}) => {
  const doc = parse();
  const place = vi.fn(() => Promise.resolve(result));
  const store = vi.fn(() => Promise.resolve(result));
  const save = vi.fn(() => Promise.resolve());
  const reload = vi.fn();
  renderProbes(doc, { armies, watched, targets, place, store, save, reload });
  const box = doc.querySelector(".optizzz-probes");
  const buttonNamed = (label: string) =>
    [...(box?.querySelectorAll<HTMLButtonElement>("p button") ?? [])].find((button) => button.textContent === label) ??
    null;
  return {
    doc,
    box,
    place,
    store,
    save,
    reload,
    button: buttonNamed("Placer les sondes"),
    storeButton: buttonNamed("Replacer l'armée"),
  };
};

describe("renderProbes", () => {
  it("warns above the garrison and says which ants would move where", () => {
    const { box, button } = setup({ targets: { ...DEFAULT_PROBE_TARGETS, lodge: { JSN: 1000 } } });
    expect(box?.nextElementSibling?.textContent).toContain("Troupes en Garnison");
    expect(box?.textContent).toContain("Il manque des sondes sur la Loge");
    expect(button?.textContent).toBe("Placer les sondes");
    expect(box?.querySelector(".optizzz-probes-moves")?.textContent).toBe(
      " 1 000 JSN du Terrain de chasse vers la Loge",
    );
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
    const { box, reload, button } = setup({ result: { placed: [], missing: ["lodge"], failed: true } });
    button?.click();
    await vi.waitFor(() => {
      expect(box?.textContent).toContain("Le jeu n'a pas pris le déplacement");
    });
    expect(reload).not.toHaveBeenCalled();
  });

  it("says when too few ants are home, without a button", () => {
    const { box, button } = setup({
      armies: { field: armyFromKeys({ JSN: 1 }), nest: armyFromKeys({}), lodge: armyFromKeys({}) },
    });
    expect(box?.textContent).toContain("Il manque des sondes sur le Dôme et la Loge");
    expect(box?.textContent).toContain("Pas assez de fourmis à la maison pour les sondes du Dôme et de la Loge");
    expect(button).toBeNull();
  });

  it("shows the probes in place when nothing is missing", () => {
    const { box, button } = setup({
      armies: { field: armyFromKeys({ JSN: 9 }), nest: armyFromKeys({ JSN: 10 }), lodge: armyFromKeys({ JSN: 3 }) },
      targets: { field: {}, nest: { JSN: 10 }, lodge: { JSN: 1 } },
      watched: ["nest", "lodge"],
    });
    expect(box?.querySelector("p")?.textContent).toBe("✓ Sondes en place : Dôme 10 JSN · Loge 1 JSN.");
    expect(button).toBeNull();
  });

  it("puts the army back in the Loge on click, leaving the probes, then reloads", async () => {
    const { box, store, reload, storeButton } = setup({
      armies: { field: armyFromKeys({ JSN: 900 }), nest: armyFromKeys({ JSN: 10 }), lodge: armyFromKeys({ JSN: 3 }) },
      targets: { field: {}, nest: { JSN: 10 }, lodge: { JSN: 1 } },
      watched: ["nest", "lodge"],
    });
    expect(storeButton?.nextElementSibling?.textContent).toBe(" 900 JSN du Terrain de chasse vers la Loge");
    storeButton?.click();
    await vi.waitFor(() => {
      expect(reload).toHaveBeenCalled();
    });
    expect(store).toHaveBeenCalledOnce();
    expect(box?.textContent).toContain("Sondes en place");
  });

  it("offers no « Replacer » once the army is put away", () => {
    const { storeButton } = setup({
      armies: { field: armyFromKeys({}), nest: armyFromKeys({ JSN: 1 }), lodge: armyFromKeys({ JSN: 500 }) },
      watched: ["nest", "lodge"],
    });
    expect(storeButton).toBeNull();
  });

  it("saves the numbers set for each watched place, then reloads", async () => {
    const { box, save, reload } = setup({ watched: ["nest", "lodge"] });
    const input = (label: string) => box?.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
    expect(input("Jeune Soldate Naine, Terrain de chasse")).toBeNull();
    const lodge = input("Jeune Soldate Naine, Loge");
    if (!lodge) throw new Error("no input");
    lodge.value = "1 000";
    const nest = input("Jeune Soldate Naine, Dôme");
    if (!nest) throw new Error("no input");
    nest.value = "0";
    box?.querySelector("form")?.requestSubmit();
    await vi.waitFor(() => {
      expect(reload).toHaveBeenCalled();
    });
    expect(save).toHaveBeenCalledWith({ field: { JSN: 1 }, nest: {}, lodge: { JSN: 1000 } });
  });
});
