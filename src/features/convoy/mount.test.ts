import { describe, expect, it } from "vitest";
import commerceHtml from "./__fixtures__/commerce.html?raw";
import { mountConvoyPlanner, type ConvoyContext } from "./mount";

const now = new Date(2026, 9, 7, 20, 31, 45);
const players = [
  { pseudo: "Achak", x: 95, y: 48, alliance: "UPTEP" },
  { pseudo: "Osirus_jack", x: 94, y: 51, alliance: null },
  { pseudo: "Hardware", x: 90, y: 40, alliance: "UPTEP" },
];
const context: ConvoyContext = { me: "Achak", players, attackSpeed: 0, aphids: 0, idleWorkers: 300, taxRate: 0 };

const setup = (overrides: Partial<ConvoyContext> = {}) => {
  const doc = new DOMParser().parseFromString(commerceHtml, "text/html");
  const planner = mountConvoyPlanner(doc, { ...context, ...overrides }, () => now);
  const input = (id: string) => doc.getElementById(id) as HTMLInputElement;
  const lines = () => [...doc.querySelectorAll(".optizzz-convoy p")].map((line) => line.textContent);
  return { doc, planner, input, lines };
};

describe("mountConvoyPlanner", () => {
  it("suggests the alliance first, nearest first, on the game's recipient field", () => {
    const { doc, input } = setup();
    expect(input("pseudo_convoi").getAttribute("list")).toBe("optizzz-convoy-recipients");
    expect(
      [...doc.querySelectorAll("#optizzz-convoy-recipients option")].map((option) => option.getAttribute("value")),
    ).toEqual(["Hardware", "Osirus_jack"]);
  });

  it("times the trip to the recipient typed, and tells the workers it takes", () => {
    const { input, planner, lines } = setup();
    input("pseudo_convoi").value = "Osirus_jack";
    input("nbMateriaux").value = "5000";
    planner.render();
    expect(lines()).toEqual([
      "Osirus_jack à 3,2 cases · trajet ≈ 1 h 36 · arrivée ≈ aujourd'hui 22 h 07",
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
    missing.input("pseudo_convoi").value = "Osirus_jack";
    missing.planner.render();
    expect(missing.lines()).toEqual([
      "Vous n'êtes pas encore dans l'export public (mis à jour chaque heure) : pas de temps de trajet.",
    ]);
    const self = setup();
    self.input("pseudo_convoi").value = "achak";
    self.planner.render();
    expect(self.lines()).toEqual(["C'est vous : choisissez un autre destinataire."]);
  });

  it("still writes the convoys' arrival, and says why, without the export or the levels", () => {
    const { doc, input, planner, lines } = setup({ players: null });
    expect(doc.querySelectorAll(".optizzz-convoy-arrival")).toHaveLength(2);
    input("pseudo_convoi").value = "Osirus_jack";
    planner.render();
    expect(lines()).toEqual(["L'export public de Fourmizzz ne répond pas : pas de temps de trajet."]);
    const noLevels = setup({ attackSpeed: null, levelsHint: "Niveaux inconnus : passez par le Laboratoire." });
    noLevels.input("pseudo_convoi").value = "Osirus_jack";
    noLevels.planner.render();
    expect(noLevels.lines()).toEqual(["Niveaux inconnus : passez par le Laboratoire."]);
  });

  it("counts the harvest lost after the colonizer's tax, as the resource forecast", () => {
    const { input, planner, lines } = setup({ taxRate: 0.5 });
    input("pseudo_convoi").value = "Osirus_jack";
    input("nbMateriaux").value = "5000";
    planner.render();
    expect(lines()[1]).toBe("500 ouvrières, dont 200 au travail : ≈ 318 de récolte perdue pendant le trajet");
  });

  it("writes the arrival time after each convoy on its way", () => {
    const { doc } = setup();
    expect([...doc.querySelectorAll(".optizzz-convoy-arrival")].map((span) => span.textContent)).toEqual([
      " · arrivée aujourd'hui 21 h 54",
      " · arrivée demain 22 h 34",
    ]);
  });
});
