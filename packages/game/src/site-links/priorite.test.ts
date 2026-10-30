import { describe, expect, it } from "vitest";
import type { ConvoyItem } from "./envoi-convoys";
import { comparePriorites, prioriteOf, prioriteText, soldeOf, type Priorite } from "./priorite";
import type { ProductionReading } from "./envoi-states";

const NOW = new Date("2026-10-30T12:00:00Z");
const HOUR = 3600_000;
const DAY = 24 * HOUR;

const delivered = (from: string, to: string, food: number, materials: number, ago: number): ConvoyItem => ({
  kind: "delivered",
  from,
  to,
  food,
  materials,
  at: NOW.getTime() - ago,
});

describe("soldeOf", () => {
  it("is the convoys received less those sent over the last 30 days, food and materials added", () => {
    const convoys = [
      delivered("Messor", "Lasius", 100_000, 50_000, 2 * DAY),
      delivered("Atta", "lasius", 0, 30_000, 10 * DAY),
      delivered("Lasius", "Messor", 20_000, 0, DAY),
      // Between two others: not Lasius's.
      delivered("Messor", "Atta", 999_000, 0, DAY),
    ];
    // 150 000 + 30 000 − 20 000
    expect(soldeOf("Lasius", convoys, NOW)).toBe(160_000);
  });

  it("leaves out the convoys delivered more than 30 days ago, and those still on their way", () => {
    const convoys = [
      delivered("Messor", "Lasius", 0, 100_000, 31 * DAY),
      { ...delivered("Messor", "Lasius", 0, 70_000, 0), kind: "transit" as const, at: NOW.getTime() + HOUR },
      // On its way, its arrival past: it comes back as delivered once one of the two reads their inbox.
      { ...delivered("Messor", "Lasius", 0, 40_000, HOUR), kind: "transit" as const },
      delivered("Messor", "Lasius", 0, 10_000, 29 * DAY),
    ];
    expect(soldeOf("Lasius", convoys, NOW)).toBe(10_000);
  });

  it("is negative for a player who sent more than they received", () => {
    expect(soldeOf("Messor", [delivered("Messor", "Lasius", 0, 80_000, DAY)], NOW)).toBe(-80_000);
  });
});

/** (2 000 + 3 000) × 48 + 10 000 = 250 000 a day, no colonizer, no colony. */
const production: ProductionReading = {
  huntingField: 10_000,
  workers: 6_000,
  foodWorkers: 2_000,
  materialWorkers: 3_000,
  mushroomPerDay: 10_000,
  taxRate: 0,
  master: null,
  colonies: [],
};

describe("prioriteOf", () => {
  const received = (materials: number) => [delivered("Messor", "Lasius", 0, materials, DAY)];

  it("is the Solde divided by the Production: how many days of their own production they received", () => {
    expect(prioriteOf({ player: "Lasius", convoys: received(4_600_000), production, now: NOW })).toEqual({
      kind: "known",
      solde: 4_600_000,
      production: 250_000,
      days: 18.4,
      bound: "exact",
      atLeast: false,
    });
  });

  it("is negative for a player who gave more than they received", () => {
    const sent = [delivered("Lasius", "Messor", 0, 500_000, DAY)];
    expect(prioriteOf({ player: "Lasius", convoys: sent, production, now: NOW })).toMatchObject({ days: -2 });
  });

  it("counts the Production of a colonised player after the tax they pay their colonizer", () => {
    const colonised = { ...production, master: "Atta", taxRate: 0.2 };
    // 250 000 − 50 000
    expect(
      prioriteOf({ player: "Lasius", convoys: received(1_000_000), production: colonised, now: NOW }),
    ).toMatchObject({ production: 200_000, days: 5 });
  });

  it("counts the Production of a colonizer with what their colonies pay them a day", () => {
    const colonies = [{ pseudo: "Atta", since: NOW.getTime() - 4 * DAY, food: 100_000, materials: 900_000 }];
    // 250 000 + 1 000 000 / 4 days
    expect(
      prioriteOf({ player: "Lasius", convoys: received(1_000_000), production: { ...production, colonies }, now: NOW }),
    ).toMatchObject({ production: 500_000, days: 2 });
  });

  it("is unknown without a Production sent, or when the player does not send their Convois", () => {
    expect(prioriteOf({ player: "Lasius", convoys: received(1), production: null, now: NOW })).toEqual({
      kind: "unknown",
      solde: 1,
      production: null,
      missing: ["production"],
    });
    expect(prioriteOf({ player: "Lasius", convoys: null, production, now: NOW })).toEqual({
      kind: "unknown",
      solde: null,
      production: 250_000,
      missing: ["convoys"],
    });
  });

  it("is a bound when the Production is only « at least » (a colony taken less than an hour ago)", () => {
    const colonies = [{ pseudo: "Atta", since: NOW.getTime() - 10 * 60_000, food: 0, materials: 0 }];
    const partial = { ...production, colonies };
    // More Production: fewer days received, and fewer days given.
    expect(prioriteOf({ player: "Lasius", convoys: received(500_000), production: partial, now: NOW })).toMatchObject({
      kind: "known",
      days: 2,
      bound: "at-most",
    });
    const sent = [delivered("Lasius", "Messor", 0, 500_000, DAY)];
    expect(prioriteOf({ player: "Lasius", convoys: sent, production: partial, now: NOW })).toMatchObject({
      days: -2,
      bound: "at-least",
    });
    expect(prioriteOf({ player: "Lasius", convoys: [], production: partial, now: NOW })).toMatchObject({
      days: 0,
      bound: "exact",
      atLeast: true,
    });
  });

  it("has no number of days when the Production is nil", () => {
    const idle = { ...production, foodWorkers: 0, materialWorkers: 0, mushroomPerDay: 0 };
    expect(prioriteOf({ player: "Lasius", convoys: received(1_000), production: idle, now: NOW })).toEqual({
      kind: "no-production",
      solde: 1_000,
    });
    // Nil only as far as one knows: the colonies not read may be all of it.
    expect(
      prioriteOf({ player: "Lasius", convoys: [], production: { ...idle, colonies: null }, now: NOW }),
    ).toMatchObject({ kind: "unknown", missing: ["production"] });
  });

  it("counts a convoy from a member who does not send, as the requester's own extension reported it", () => {
    // Atta sends nothing: Lasius's extension read « Convoi reçu de Atta » in their inbox.
    const fromAtta = [delivered("Atta", "Lasius", 250_000, 0, DAY)];
    expect(prioriteOf({ player: "Lasius", convoys: fromAtta, production, now: NOW })).toMatchObject({ days: 1 });
  });
});

describe("comparePriorites", () => {
  const known = (days: number): Priorite => ({
    kind: "known",
    solde: days,
    production: 1,
    days,
    bound: "exact",
    atLeast: false,
  });
  const nil = (solde: number): Priorite => ({ kind: "no-production", solde });
  const unknown: Priorite = { kind: "unknown", solde: null, production: null, missing: ["convoys"] };

  it("puts the lowest first, a nil Production as the Solde says, the unknown last", () => {
    const ranked = [unknown, known(18.4), nil(5), known(-2), nil(0), known(1), nil(-5)].sort(comparePriorites);
    expect(ranked).toEqual([nil(-5), known(-2), nil(0), known(1), known(18.4), nil(5), unknown]);
  });

  it("ties two unknown, and two nil Productions on the same side", () => {
    expect(comparePriorites(unknown, { ...unknown, missing: ["production"] })).toBe(0);
    expect(comparePriorites(nil(5), nil(9))).toBe(0);
    expect(comparePriorites(nil(0), known(0))).toBe(0);
  });
});

describe("prioriteText", () => {
  it("writes the days as the game writes numbers, and a bound with its sign", () => {
    expect(prioriteText({ kind: "known", solde: 1, production: 1, days: 18.44, bound: "exact", atLeast: false })).toBe(
      "18,4 jours",
    );
    expect(prioriteText({ kind: "known", solde: 1, production: 1, days: 1, bound: "exact", atLeast: false })).toBe(
      "1 jour",
    );
    expect(prioriteText({ kind: "known", solde: 0, production: 1, days: 0, bound: "exact", atLeast: false })).toBe(
      "0 jour",
    );
    expect(prioriteText({ kind: "known", solde: -1, production: 1, days: -2.5, bound: "exact", atLeast: false })).toBe(
      "-2,5 jours",
    );
    expect(prioriteText({ kind: "known", solde: 1, production: 1, days: 2, bound: "at-most", atLeast: true })).toBe(
      "≤ 2 jours",
    );
    expect(prioriteText({ kind: "known", solde: -1, production: 1, days: -2, bound: "at-least", atLeast: true })).toBe(
      "≥ -2 jours",
    );
  });

  it("says when there is no number of days", () => {
    expect(prioriteText({ kind: "no-production", solde: 3 })).toBe("Production nulle");
    expect(prioriteText({ kind: "unknown", solde: null, production: 1, missing: ["convoys"] })).toBe(
      "Priorité inconnue",
    );
  });
});
