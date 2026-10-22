import { describe, expect, it } from "vitest";
import { allianceProduction, type ProductionInput } from "./production";

const player = (id: number, alliance: string | null, field: number, masterPlayerId: number | null = null) => ({
  id,
  pseudo: `P${String(id)}`,
  alliance,
  field,
  masterPlayerId,
});

const input = (overrides: Partial<ProductionInput> = {}): ProductionInput => ({
  members: [
    { id: 1, pseudo: "P1", field: 1000, workers: 600, masterId: null },
    { id: 2, pseudo: "P2", field: 500, workers: null, masterId: null },
  ],
  players: [player(1, "ME", 1000), player(2, "ME", 500)],
  paidRates: new Map(),
  receivedRates: new Map(),
  ...overrides,
});

describe("allianceProduction", () => {
  it("adds up the ceiling (TDC × 48) and the real harvest of the members whose workers are known", () => {
    const production = allianceProduction(input());
    expect(production.members.map((m) => [m.pseudo, m.ceiling, m.real])).toEqual([
      ["P1", 48_000, 28_800],
      ["P2", 24_000, null],
    ]);
    expect(production.ceiling).toEqual({ gross: 72_000, paid: 0, received: 0, net: 72_000 });
    expect(production.real).toEqual({
      gross: 28_800,
      paid: 0,
      received: 0,
      net: 28_800,
      known: 1,
      total: 2,
      ceiling: 48_000,
    });
    expect(production.exact).toBe(true);
  });

  it("caps the real harvest at the TDC: idle workers harvest nothing", () => {
    const production = allianceProduction(
      input({ members: [{ id: 1, pseudo: "P1", field: 100, workers: 5000, masterId: null }] }),
    );
    expect(production.members[0]?.real).toBe(4_800);
  });

  it("takes off the tax paid to a master outside the alliance, at least 20 % when the rate is unknown", () => {
    const production = allianceProduction(
      input({
        members: [{ id: 1, pseudo: "P1", field: 1000, workers: 600, masterId: 9 }],
        players: [player(1, "ME", 1000, 9), player(9, "THEM", 5000)],
      }),
    );
    expect(production.members[0]?.paid).toEqual({ ceiling: 9_600, real: 5_760, exact: false, master: "P9" });
    expect(production.ceiling).toEqual({ gross: 48_000, paid: 9_600, received: 0, net: 38_400 });
    expect(production.real.net).toBe(23_040);
    expect(production.exact).toBe(false);
  });

  it("uses the exact rate when known", () => {
    const production = allianceProduction(
      input({
        members: [{ id: 1, pseudo: "P1", field: 1000, workers: null, masterId: 9 }],
        players: [player(1, "ME", 1000, 9), player(9, "THEM", 5000)],
        paidRates: new Map([[1, 0.33]]),
      }),
    );
    expect(production.members[0]?.paid).toEqual({ ceiling: 15_840, real: null, exact: true, master: "P9" });
    expect(production.exact).toBe(true);
  });

  it("ignores a tax paid to another member: it stays in the alliance", () => {
    const production = allianceProduction(
      input({
        members: [
          { id: 1, pseudo: "P1", field: 1000, workers: null, masterId: 2 },
          { id: 2, pseudo: "P2", field: 500, workers: null, masterId: null },
        ],
        players: [player(1, "ME", 1000, 2), player(2, "ME", 500)],
      }),
    );
    expect(production.members.every((m) => m.paid === null && m.received === null)).toBe(true);
    expect(production.ceiling.net).toBe(72_000);
  });

  it("shows a tax between two members on both rows, on the real harvest when known", () => {
    const production = allianceProduction(
      input({
        members: [
          { id: 1, pseudo: "P1", field: 1000, workers: 600, masterId: 2 },
          { id: 2, pseudo: "P2", field: 500, workers: null, masterId: null },
        ],
        players: [player(1, "ME", 1000, 2), player(2, "ME", 500)],
        // My stable gives the rate of my colonies.
        receivedRates: new Map([[2, 0.3]]),
      }),
    );
    expect(production.members[0]?.paidInside).toEqual({ amount: 8_640, exact: true, master: "P2" });
    expect(production.members[1]?.receivedInside).toEqual({ amount: 8_640, exact: true, colonies: 1 });
    expect(production.real.net).toBe(28_800);
  });

  it("adds the tax received from colonies outside the alliance, on their ceiling", () => {
    const production = allianceProduction(
      input({
        players: [player(1, "ME", 1000), player(2, "ME", 500), player(7, null, 100, 1), player(8, "X", 200, 1)],
        receivedRates: new Map([[1, 0.25]]),
      }),
    );
    expect(production.members[0]?.received).toEqual({ amount: 3_600, exact: true, colonies: 2 });
    expect(production.ceiling).toEqual({ gross: 72_000, paid: 0, received: 3_600, net: 75_600 });
    // P1's workers are known: their colonies count in the real harvest too.
    expect(production.real.received).toBe(3_600);
  });
});
