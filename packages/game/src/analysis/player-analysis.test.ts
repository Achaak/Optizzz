import { describe, expect, it } from "vitest";
import { floodText, floodWhen, type FloodLine } from "./player-analysis";

const line = (fields: Partial<FloodLine>): FloodLine => ({
  since: "2026-11-20T12:05:00.000Z",
  at: "2026-11-20T13:05:00.000Z",
  direction: "lost",
  amount: 128_400,
  others: [],
  alliance: null,
  sureness: "unknown",
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
    expect(floodText(line({ sureness: "candidates", others: [lunaire, { ...bzz, alliance: null }] }))).toBe(
      "candidats : Lunaire, Bzz",
    );
    expect(floodText(line({}))).toBe("coupable inconnu");
    expect(floodText(line({ direction: "taken", sureness: "sure", others: [lunaire] }))).toBe(
      "probablement pris à Lunaire (AP)",
    );
  });
});
