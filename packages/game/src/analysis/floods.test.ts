import { describe, expect, it } from "vitest";
import { probableFloods } from "./floods";

/** A player whose field went from `from` to `to` in the hour. */
const moved = (id: number, from: number, to: number, alliance: string | null = null) => ({ id, from, to, alliance });

function hour(players: ReturnType<typeof moved>[]) {
  return {
    before: players.map(({ id, from, alliance }) => ({ id, field: from, alliance })),
    after: players.map(({ id, to, alliance }) => ({ id, field: to, alliance })),
  };
}

const floodsOf = (players: ReturnType<typeof moved>[]) => {
  const { before, after } = hour(players);
  return probableFloods(before, after);
};

describe("probableFloods", () => {
  it("is sure when one player in range won what the victim lost", () => {
    // 10 000 is 200 % of 5 000: in range. The attacker wins exactly what the victim loses.
    expect(floodsOf([moved(1, 10_000, 9000), moved(2, 5000, 6000), moved(3, 8000, 8000)])).toEqual([
      { victimId: 1, amount: 1000, attackers: [2], candidates: [2], alliance: null, sureness: "sure" },
    ]);
  });

  it("matches only the exact amount: a gain one cm² off is something else (a hunt back as well)", () => {
    expect(floodsOf([moved(1, 10_000, 9000), moved(2, 5000, 6001)])).toEqual([
      { victimId: 1, amount: 1000, attackers: [], candidates: [2], alliance: null, sureness: "candidates" },
    ]);
    // Nor a combination one cm² off: 1 200 + 799.
    expect(floodsOf([moved(1, 20_000, 18_000), moved(2, 10_000, 11_200), moved(3, 10_000, 10_799)])[0]?.sureness).toBe(
      "candidates",
    );
  });

  it("finds the one combination of players in range whose gains make the loss", () => {
    // 1 200 + 800 = 2 000; no other pair or trio of these gains makes it.
    const floods = floodsOf([
      moved(1, 20_000, 18_000),
      moved(2, 10_000, 11_200, "X"),
      moved(3, 10_000, 10_800, "Y"),
      moved(4, 10_000, 10_500, "Y"),
    ]);
    expect(floods).toEqual([
      { victimId: 1, amount: 2000, attackers: [2, 3], candidates: [2, 3, 4], alliance: null, sureness: "combination" },
    ]);
  });

  it("finds one attacker who took from several victims in the hour", () => {
    // 1 500 = 1 000 + 500, both victims in range of the attacker.
    const floods = floodsOf([moved(1, 10_000, 9000), moved(2, 10_000, 9500), moved(3, 8000, 9500, "ABC")]);
    expect(floods).toEqual([
      { victimId: 1, amount: 1000, attackers: [3], candidates: [3], alliance: "ABC", sureness: "combination" },
      { victimId: 2, amount: 500, attackers: [3], candidates: [3], alliance: "ABC", sureness: "combination" },
    ]);
  });

  it("names the candidates when nothing matches, and their alliance when they share one", () => {
    // Gains mixed with hunts: 3 000 each against a loss of 1 000.
    expect(floodsOf([moved(1, 10_000, 9000), moved(2, 8000, 11_000, "abc"), moved(3, 9000, 12_000, "ABC")])).toEqual([
      { victimId: 1, amount: 1000, attackers: [], candidates: [2, 3], alliance: "abc", sureness: "candidates" },
    ]);
  });

  it("knows no culprit when no player in range gained, and leaves out losses of 1 % or less", () => {
    // 1 000 won by a player of 2 000: 10 000 is 500 % of them, out of range.
    expect(floodsOf([moved(1, 10_000, 9000), moved(2, 2000, 3000), moved(3, 50_000, 49_500)])).toEqual([
      { victimId: 1, amount: 1000, attackers: [], candidates: [], alliance: null, sureness: "unknown" },
    ]);
  });
});
