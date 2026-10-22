import { describe, expect, it, vi } from "vitest";
import armeeMoveHtml from "@/data/__fixtures__/armee-move.html?raw";
import { DEFAULT_PROBE_TARGETS, type ProbesResult, type ProbeTargets } from "@/data/probes";
import type { Place } from "@optizzz/game/army/battle";
import { armyFromKeys } from "@optizzz/game/army/units";
import { renderProbes } from "./mount";

const parse = () => new DOMParser().parseFromString(armeeMoveHtml, "text/html");

const setup = ({
  armies = { field: armyFromKeys({ JSN: 1500 }), nest: armyFromKeys({ JSN: 2 }), lodge: armyFromKeys({}) },
  targets = { field: { JSN: 1 }, nest: { JSN: 1 }, lodge: { JSN: 1 } },
  result = { placed: ["lodge"], missing: [], failed: false },
}: {
  armies?: Record<Place, number[]>;
  targets?: ProbeTargets;
  result?: ProbesResult;
} = {}) => {
  const doc = parse();
  const place = vi.fn(() => Promise.resolve(result));
  const store = vi.fn(() => Promise.resolve(result));
  const save = vi.fn(() => Promise.resolve());
  const reload = vi.fn();
  renderProbes(doc, { armies, targets, place, store, save, reload });
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
    button: buttonNamed("Placer les anti-sondes"),
    storeButton: buttonNamed("Replacer l'armée"),
  };
};

describe("renderProbes", () => {
  it("warns above the garrison and says which ants would move where", () => {
    const { box, button } = setup({ targets: { field: { JSN: 1 }, nest: { JSN: 1 }, lodge: { JSN: 1000 } } });
    expect(box?.nextElementSibling?.textContent).toContain("Troupes en Garnison");
    expect(box?.textContent).toContain("Il manque des anti-sondes sur la Loge");
    expect(button?.textContent).toBe("Placer les anti-sondes");
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
    expect(box?.textContent).toContain("Il manque des anti-sondes sur le Dôme et la Loge");
    expect(box?.textContent).toContain("Pas assez de fourmis à la maison pour les anti-sondes du Dôme et de la Loge");
    expect(button).toBeNull();
  });

  it("shows the probes in place when nothing is missing", () => {
    const { box, button } = setup({
      armies: { field: armyFromKeys({ JSN: 9 }), nest: armyFromKeys({ JSN: 10 }), lodge: armyFromKeys({ JSN: 3 }) },
      targets: { field: {}, nest: { JSN: 10 }, lodge: { JSN: 1 } },
    });
    expect(box?.querySelector("p")?.textContent).toBe("✓ Anti-sondes en place : Dôme 10 JSN · Loge 1 JSN.");
    expect(button).toBeNull();
  });

  it("puts the army back in the Loge on click, leaving the probes, then reloads", async () => {
    const { box, store, reload, storeButton } = setup({
      armies: { field: armyFromKeys({ JSN: 900 }), nest: armyFromKeys({ JSN: 10 }), lodge: armyFromKeys({ JSN: 3 }) },
      targets: { field: {}, nest: { JSN: 10 }, lodge: { JSN: 1 } },
    });
    expect(storeButton?.nextElementSibling?.textContent).toBe(" 900 JSN du Terrain de chasse vers la Loge");
    storeButton?.click();
    await vi.waitFor(() => {
      expect(reload).toHaveBeenCalled();
    });
    expect(store).toHaveBeenCalledOnce();
    expect(box?.textContent).toContain("Anti-sondes en place");
  });

  it("offers no « Replacer » once the army is put away", () => {
    const { storeButton } = setup({
      armies: { field: armyFromKeys({}), nest: armyFromKeys({ JSN: 1 }), lodge: armyFromKeys({ JSN: 500 }) },
      targets: DEFAULT_PROBE_TARGETS,
    });
    expect(storeButton).toBeNull();
  });

  it("asks for the probes, settings open, when no place keeps any", () => {
    const { box, button } = setup({ targets: { field: {}, nest: {}, lodge: {} } });
    expect(box?.querySelector("p")?.textContent).toBe(
      "Aucune anti-sonde : choisissez ci-dessous combien de fourmis garder sur chaque lieu.",
    );
    expect(box?.querySelector("details")?.open).toBe(true);
    expect(button).toBeNull();
  });

  it("saves the numbers set for each place, the Terrain de chasse too, then reloads", async () => {
    const { box, save, reload } = setup({ targets: DEFAULT_PROBE_TARGETS });
    expect(box?.querySelector("details")?.open).toBe(false);
    const input = (label: string) => {
      const found = box?.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
      if (!found) throw new Error(`no input ${label}`);
      return found;
    };
    expect(input("Jeune Soldate Naine, Terrain de chasse").value).toBe("0");
    input("Jeune Soldate Naine, Terrain de chasse").value = "5";
    input("Jeune Soldate Naine, Loge").value = "1 000";
    input("Jeune Soldate Naine, Dôme").value = "0";
    box?.querySelector("form")?.requestSubmit();
    await vi.waitFor(() => {
      expect(reload).toHaveBeenCalled();
    });
    expect(save).toHaveBeenCalledWith({ field: { JSN: 5 }, nest: {}, lodge: { JSN: 1000 } });
  });
});
