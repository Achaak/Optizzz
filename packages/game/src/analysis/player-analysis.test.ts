import { describe, expect, it } from "vitest";
import { floodSummary, floodText, floodWhen, type FloodLine } from "./player-analysis";

const line = (fields: Partial<FloodLine>): FloodLine => ({
  since: "2026-11-20T12:05:00.000Z",
  at: "2026-11-20T13:05:00.000Z",
  direction: "lost",
  amount: 128_400,
  others: [],
  alliance: null,
  sureness: "unknown",
  inside: false,
  ...fields,
});
const lunaire = { id: 1, pseudo: "Lunaire", alliance: "AP" };
const bzz = { id: 2, pseudo: "Bzz", alliance: "AP" };

describe("floodWhen", () => {
  it("says the Paris hours of the two exports, the day once", () => {
    expect(floodWhen(line({}), new Date("2026-11-20T18:00:00Z"))).toBe("aujourd'hui entre 13 h et 14 h");
    expect(floodWhen(line({}), new Date("2026-11-21T18:00:00Z"))).toBe("hier entre 13 h et 14 h");
  });
});

describe("floodText", () => {
  it("says who probably took it, as sure as the match is", () => {
    expect(floodText(line({ sureness: "sure", others: [lunaire], alliance: "AP" }))).toBe(
      "probablement par Lunaire (AP)",
    );
    expect(floodText(line({ sureness: "combination", others: [lunaire, bzz], alliance: "AP" }))).toBe(
      "probablement par Lunaire et Bzz",
    );
    expect(floodText(line({ sureness: "candidates", others: [lunaire, bzz], alliance: "AP" }))).toBe(
      "par l'alliance AP, sans savoir qui",
    );
    // Up to 20 players of every alliance said nothing: counted, not listed.
    expect(floodText(line({ sureness: "candidates", others: [lunaire, { ...bzz, alliance: null }] }))).toBe(
      "coupable inconnu · 2 joueurs à portée ont gagné dans l'heure",
    );
    const twenty = Array.from({ length: 20 }, (_, i) => ({ id: i, pseudo: `P${String(i)}`, alliance: null }));
    expect(floodText(line({ sureness: "candidates", others: twenty }))).toBe(
      "coupable inconnu · 20 joueurs ou plus à portée ont gagné dans l'heure",
    );
    expect(floodText(line({}))).toBe("coupable inconnu");
    expect(floodText(line({ direction: "taken", sureness: "sure", others: [lunaire] }))).toBe(
      "probablement pris à Lunaire (AP)",
    );
  });

  it("says a flood between two members of the same alliance is the TDC chain", () => {
    expect(floodText(line({ sureness: "sure", others: [lunaire], alliance: "AP", inside: true }))).toBe(
      "probablement par Lunaire (AP) · dans l'alliance (chaîne de TDC)",
    );
  });
});

describe("floodSummary", () => {
  it("counts the losses by who took them, then the floods taken", () => {
    const lines = [
      line({ sureness: "sure", others: [lunaire], alliance: "AP", inside: true }),
      line({ sureness: "combination", others: [lunaire, bzz], alliance: "AP", inside: true }),
      line({ sureness: "sure", others: [{ id: 3, pseudo: "Grop", alliance: "4O4" }], alliance: "4O4" }),
      line({ sureness: "candidates", others: [lunaire, bzz], alliance: "AP", inside: true }),
      line({ sureness: "candidates", others: [lunaire] }),
      line({}),
      line({ direction: "taken", sureness: "sure", others: [lunaire] }),
    ];
    expect(floodSummary(lines, "30 jours")).toBe(
      "6 pertes en 30 jours : 3 dans l'alliance, 1 par d'autres alliances, 2 sans coupable sûr · 1 flood pris",
    );
    expect(floodSummary([], "7 j")).toBe("Aucun flood probable en 7 j.");
  });
});
