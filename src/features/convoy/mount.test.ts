import { describe, expect, it } from "vitest";
import commerceHtml from "./__fixtures__/commerce.html?raw";
import { mountConvoyPlanner } from "./mount";

const now = new Date(2026, 9, 7, 20, 31, 45);
const players = [
  { pseudo: "Achak", x: 95, y: 48, alliance: "UPTEP" },
  { pseudo: "Osirus_jack", x: 94, y: 51, alliance: null },
  { pseudo: "Hardware", x: 90, y: 40, alliance: "UPTEP" },
];
const context = { me: "Achak", players, attackSpeed: 0, aphids: 0, idleWorkers: 300 };

const setup = () => {
  const doc = new DOMParser().parseFromString(commerceHtml, "text/html");
  const planner = mountConvoyPlanner(doc, context, () => now);
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
    expect(lines()).toEqual(["Inconnu n'est pas dans l'export d'hier : pas de temps de trajet."]);
  });

  it("writes the arrival time after each convoy on its way", () => {
    const { doc } = setup();
    expect([...doc.querySelectorAll(".optizzz-convoy-arrival")].map((span) => span.textContent)).toEqual([
      " · arrivée aujourd'hui 21 h 54",
      " · arrivée demain 22 h 34",
    ]);
  });
});
