import { afterEach, describe, expect, it, vi } from "vitest";
import commerceHtml from "./__fixtures__/commerce.html?raw";
import { mountConvoyPlanner, type ConvoyContext } from "./mount";

const now = new Date(2026, 9, 7, 20, 31, 45);
const players = [
  { pseudo: "Formica", x: 55, y: 28, alliance: "XYZ" },
  { pseudo: "Messor", x: 54, y: 31, alliance: null },
  { pseudo: "Tetramorium", x: 50, y: 20, alliance: "XYZ" },
];
const context: ConvoyContext = { me: "Formica", players, attackSpeed: 0, aphids: 0, idleWorkers: 300, taxRate: 0 };

const setup = (overrides: Partial<ConvoyContext> = {}) => {
  const doc = new DOMParser().parseFromString(commerceHtml, "text/html");
  const copied: string[] = [];
  const copy = (text: string) => {
    copied.push(text);
    return Promise.resolve();
  };
  const planner = mountConvoyPlanner(doc, { ...context, ...overrides }, () => now, copy);
  stops.push(planner.stopCountdown);
  const input = (id: string) => doc.getElementById(id) as HTMLInputElement;
  const lines = () => [...doc.querySelectorAll(".optizzz-convoy p")].map((line) => line.textContent);
  return { doc, planner, input, lines, copied };
};
const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
});

describe("mountConvoyPlanner", () => {
  it("suggests the alliance first, nearest first, on the game's recipient field", () => {
    const { doc, input } = setup();
    expect(input("pseudo_convoi").getAttribute("list")).toBe("optizzz-convoy-recipients");
    expect(
      [...doc.querySelectorAll("#optizzz-convoy-recipients option")].map((option) => option.getAttribute("value")),
    ).toEqual(["Tetramorium", "Messor"]);
  });

  it("times the trip to the recipient typed, and tells the workers it takes", () => {
    const { input, planner, lines } = setup();
    input("pseudo_convoi").value = "Messor";
    input("nbMateriaux").value = "5000";
    planner.render();
    expect(lines()).toEqual([
      "Messor à 3,2 cases · trajet ≈ 1 h 36 · arrivée ≈ aujourd'hui 22 h 07",
      "500 ouvrières, dont 200 au travail : ≈ 637 de récolte perdue pendant le trajet",
      "Le surplus est perdu si ses entrepôts débordent.",
    ]);
  });

  it("says when the recipient is not in the export", () => {
    const { input, planner, lines } = setup();
    input("pseudo_convoi").value = "Inconnu";
    planner.render();
    expect(lines()).toEqual([
      "Inconnu n'est pas dans l'export public (mis à jour chaque heure) : pas de temps de trajet.",
    ]);
  });

  it("tells apart the sender missing from the export, and a convoy to oneself", () => {
    const missing = setup({ me: "Nouveau" });
    missing.input("pseudo_convoi").value = "Messor";
    missing.planner.render();
    expect(missing.lines()).toEqual([
      "Vous n'êtes pas encore dans l'export public (mis à jour chaque heure) : pas de temps de trajet.",
    ]);
    const self = setup();
    self.input("pseudo_convoi").value = "formica";
    self.planner.render();
    expect(self.lines()).toEqual(["C'est vous : choisissez un autre destinataire."]);
  });

  it("still writes the convoys' arrival, and says why, without the export or the levels", () => {
    const { doc, input, planner, lines } = setup({ players: null });
    expect(doc.querySelectorAll(".optizzz-on-way-row")).toHaveLength(3);
    input("pseudo_convoi").value = "Messor";
    planner.render();
    expect(lines()).toEqual(["L'export public de Fourmizzz ne répond pas : pas de temps de trajet."]);
    const noLevels = setup({ attackSpeed: null, levelsHint: "Niveaux inconnus : passez par le Laboratoire." });
    noLevels.input("pseudo_convoi").value = "Messor";
    noLevels.planner.render();
    expect(noLevels.lines()).toEqual(["Niveaux inconnus : passez par le Laboratoire."]);
  });

  it("counts the harvest lost after the colonizer's tax, as the resource forecast", () => {
    const { input, planner, lines } = setup({ taxRate: 0.5 });
    input("pseudo_convoi").value = "Messor";
    input("nbMateriaux").value = "5000";
    planner.render();
    expect(lines()[1]).toBe("500 ouvrières, dont 200 au travail : ≈ 318 de récolte perdue pendant le trajet");
  });

  it("lists the convoys on their way in place of the game's lines, with their arrival", () => {
    const { doc } = setup();
    const rows = [...doc.querySelectorAll(".optizzz-on-way-row")];
    expect(rows.map((row) => row.querySelector(".optizzz-on-way-to")?.textContent)).toEqual([
      "→ Messor",
      "→ Tetramorium",
      "← de Polyergus",
    ]);
    expect(rows.map((row) => row.querySelector(".optizzz-on-way-left")?.textContent)).toEqual([
      "dans 1H 22m 22s",
      "dans 1J 2H 3m 4s",
      "dans 8H 6m 59s",
    ]);
    expect(rows.map((row) => row.querySelector(".optizzz-on-way-when")?.textContent)).toEqual([
      "arrivée aujourd'hui 21 h 54Retour le 7 oct. à 21h54",
      "arrivée demain 22 h 34",
      // The game's « Retour » on a convoy received is its arrival.
      "arrivée demain 4 h 38",
    ]);
    expect(rows[1]?.querySelector(".optizzz-convoy-materials")?.textContent).toBe("12 500matériaux");
    expect(rows[2]?.querySelector(".optizzz-convoy-food")?.textContent).toBe("2nourriture");
    const gameLines = [...doc.querySelectorAll("strong, span.gras, small")].filter((line) =>
      /livrer|recevoir|Retour/.test(line.textContent),
    );
    expect(gameLines).toHaveLength(5);
    expect(gameLines.every((line) => (line as HTMLElement).hidden)).toBe(true);
    expect(doc.querySelector(".Bas")?.hasAttribute("hidden")).toBe(false);
  });

  it("keeps the game's « Annuler » link in the row of the convoy it cancels", () => {
    const { doc } = setup();
    const rows = [...doc.querySelectorAll(".optizzz-on-way-row")];
    const cancels = rows.map((row) => row.querySelector<HTMLAnchorElement>(".optizzz-on-way-actions a"));
    expect(cancels.map((link) => link?.textContent)).toEqual(["Annuler", undefined, undefined]);
    expect(cancels[0]?.getAttribute("href")).toBe("commerce.php?annuler=1&t=TOKEN");
    expect(cancels[0]?.closest("[hidden]")).toBeNull();
  });

  it("copies a convoy as one line of text", async () => {
    const { doc, copied } = setup();
    const button = doc.querySelector<HTMLButtonElement>(".optizzz-on-way-copy");
    button?.click();
    await vi.waitFor(() => {
      expect(button?.textContent).toBe("Copié !");
    });
    expect(copied).toEqual([
      "Vous allez livrer 1 nourriture et 0 matériaux à Messor dans 1H 22m 22s · arrivée aujourd'hui 21 h 54 - Retour le 7 oct. à 21h54",
    ]);
  });

  it("copies a convoy received, from its sender", async () => {
    const { doc, copied } = setup();
    const button = [...doc.querySelectorAll<HTMLButtonElement>(".optizzz-on-way-copy")].at(-1);
    button?.click();
    await vi.waitFor(() => {
      expect(copied).toEqual([
        "Vous allez recevoir 2 nourriture et 1 matériaux de Polyergus dans 8H 6m 59s · arrivée demain 4 h 38",
      ]);
    });
  });

  it("counts the time left down", () => {
    vi.useFakeTimers();
    try {
      let at = now;
      const doc = new DOMParser().parseFromString(commerceHtml, "text/html");
      const planner = mountConvoyPlanner(
        doc,
        context,
        () => at,
        () => Promise.resolve(),
      );
      at = new Date(now.getTime() + 2000);
      vi.advanceTimersByTime(1000);
      expect(doc.querySelector(".optizzz-on-way-left")?.textContent).toBe("dans 1H 22m 20s");
      at = new Date(now.getTime() + 2 * 3_600_000);
      vi.advanceTimersByTime(1000);
      expect(doc.querySelector(".optizzz-on-way-left")?.textContent).toBe("arrivé");
      planner.stopCountdown();
    } finally {
      vi.useRealTimers();
    }
  });
});
