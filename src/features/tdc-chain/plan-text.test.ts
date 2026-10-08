import { describe, expect, it } from "vitest";
import { planText } from "./plan-text";

const at = (hours: number, minutes: number) => new Date(2026, 9, 8, hours, minutes);

describe("planText", () => {
  it("lists the attacks in landing order, with departure, ants and arrival, ready for a collective message", () => {
    const text = planText(
      [
        { attacker: "Achak", target: "Morel", ants: 620, departure: at(20, 0), arrival: at(21, 0) },
        { attacker: "Delta", target: "Achak", ants: 1080, departure: at(20, 51), arrival: at(21, 1) },
      ],
      at(19, 30),
    );
    expect(text).toBe(
      [
        "Chaîne de TDC : arrivées une par minute à partir de 21 h 00. Rien en défense sur le Terrain de Chasse.",
        "1. 20 h 00 : Achak attaque Morel avec 620 fourmis (arrivée 21 h 00)",
        "2. 20 h 51 : Delta attaque Achak avec 1 080 fourmis (arrivée 21 h 01)",
      ].join("\n"),
    );
  });
});
