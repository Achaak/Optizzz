import { describe, expect, it } from "vitest";
import { byDeparture, planText, type PlannedLaunch } from "./plan-text";

const at = (hours: number, minutes: number) => new Date(2026, 9, 8, hours, minutes);

const launches: PlannedLaunch[] = [
  { rank: 1, attacker: "Achak", target: "Morel", ants: 620, departure: at(20, 0), arrival: at(21, 0) },
  { rank: 2, attacker: "Delta", target: "Achak", ants: 1080, departure: at(14, 51), arrival: at(21, 1) },
];

describe("planText", () => {
  it("lists the attacks with their landing number, departure, ants and arrival, ready for a collective message", () => {
    expect(planText(byDeparture(launches), at(13, 30))).toBe(
      [
        "Chaîne de TDC : arrivées une par minute à partir de 21 h 00, dans l'ordre des numéros. Rien en défense sur le Terrain de Chasse.",
        "2. départ 14 h 51 : Delta attaque Achak avec 1 080 fourmis (arrivée 21 h 01)",
        "1. départ 20 h 00 : Achak attaque Morel avec 620 fourmis (arrivée 21 h 00)",
      ].join("\n"),
    );
  });
});

describe("byDeparture", () => {
  it("puts who leaves first first, the landing order breaking ties", () => {
    expect(byDeparture(launches).map((launch) => launch.rank)).toEqual([2, 1]);
    const tie = launches.map((launch) => ({ ...launch, departure: at(20, 0) }));
    expect(byDeparture([...tie].reverse()).map((launch) => launch.rank)).toEqual([1, 2]);
  });
});
