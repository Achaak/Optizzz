import { describe, expect, it } from "vitest";
import {
  floodCovered,
  huntCovered,
  parseWhen,
  transitCovered,
  type DeclaredFlood,
  type DeclaredHunt,
  type DeclaredTransit,
} from "./declarations";

// 2026-11-04 13:36 in Paris (UTC+1).
const now = new Date("2026-11-04T12:36:00Z");
const MIN = 60_000;

describe("parseWhen", () => {
  it("reads a Paris time of day, today when it is still to come", () => {
    expect(parseWhen("at", "18h12", now)?.toISOString()).toBe("2026-11-04T17:12:00.000Z");
    expect(parseWhen("at", "18:12", now)?.toISOString()).toBe("2026-11-04T17:12:00.000Z");
    expect(parseWhen("at", " 18 h 12 ", now)?.toISOString()).toBe("2026-11-04T17:12:00.000Z");
    expect(parseWhen("at", "18h", now)?.toISOString()).toBe("2026-11-04T17:00:00.000Z");
  });

  it("takes a time already past as tomorrow", () => {
    expect(parseWhen("at", "7h40", now)?.toISOString()).toBe("2026-11-05T06:40:00.000Z");
    expect(parseWhen("at", "13h36", now)?.toISOString()).toBe("2026-11-05T12:36:00.000Z");
  });

  it("reads a time left as the game writes it", () => {
    expect(parseWhen("in", "2h30m", now)?.getTime()).toBe(now.getTime() + 150 * MIN);
    expect(parseWhen("in", "45m", now)?.getTime()).toBe(now.getTime() + 45 * MIN);
  });

  it("refuses what it cannot read", () => {
    expect(parseWhen("at", "", now)).toBeNull();
    expect(parseWhen("at", "25h00", now)).toBeNull();
    expect(parseWhen("at", "18h75", now)).toBeNull();
    expect(parseWhen("at", "demain", now)).toBeNull();
    expect(parseWhen("in", "", now)).toBeNull();
    expect(parseWhen("in", "bientôt", now)).toBeNull();
    expect(parseWhen("in", "0", now)).toBeNull();
  });
});

const at = now.getTime() + 300 * MIN;

describe("floodCovered", () => {
  const declared: DeclaredFlood = { from: "XaTaK", target: "Lasius", attacks: 3, at };
  const sent = (target: string, when: number, from = "xatak") => ({ from, target, at: when });

  it("is covered when the member's extension sends at least as many attacks on that target, within 2 minutes", () => {
    const floods = [sent("lasius", at + MIN), sent("Lasius", at - 2 * MIN), sent("Lasius", at)];
    expect(floodCovered(declared, floods)).toBe(true);
  });

  it("is not covered by fewer attacks, another target, another sender or another arrival", () => {
    expect(floodCovered(declared, [sent("Lasius", at), sent("Lasius", at)])).toBe(false);
    expect(floodCovered(declared, [sent("Messor", at), sent("Messor", at), sent("Messor", at)])).toBe(false);
    expect(floodCovered(declared, [sent("Lasius", at, "Formica"), sent("Lasius", at), sent("Lasius", at)])).toBe(false);
    expect(floodCovered(declared, [sent("Lasius", at + 3 * MIN), sent("Lasius", at), sent("Lasius", at)])).toBe(false);
  });
});

describe("transitCovered", () => {
  const declared: DeclaredTransit = { from: "XaTaK", to: "Formica", food: 12_348, materials: 0, at };

  it("is covered by the same convoy from the extension, on its way or delivered, within 2 minutes", () => {
    expect(transitCovered(declared, [{ from: "xatak", to: "formica", food: 12_348, materials: 0, at: at + MIN }])).toBe(
      true,
    );
  });

  it("is not covered by other amounts, another recipient or a later arrival", () => {
    const convoy = { from: "XaTaK", to: "Formica", food: 12_348, materials: 0, at };
    expect(transitCovered(declared, [{ ...convoy, food: 12_000 }])).toBe(false);
    expect(transitCovered(declared, [{ ...convoy, materials: 5 }])).toBe(false);
    expect(transitCovered(declared, [{ ...convoy, to: "Lasius" }])).toBe(false);
    expect(transitCovered(declared, [{ ...convoy, from: "Lasius" }])).toBe(false);
    expect(transitCovered(declared, [{ ...convoy, at: at + 3 * MIN }])).toBe(false);
  });
});

describe("huntCovered", () => {
  const declared: DeclaredHunt = { hunter: "XaTaK", fieldGain: 1_250, returnsAt: at };

  it("is covered by a hunt of the member's log with the same cm², back within 2 minutes", () => {
    expect(huntCovered(declared, [{ hunter: "xatak", fieldGain: 1_250, returnsAt: at - MIN }])).toBe(true);
  });

  it("is not covered by another gain, hunter or return", () => {
    expect(huntCovered(declared, [{ hunter: "XaTaK", fieldGain: 1_200, returnsAt: at }])).toBe(false);
    expect(huntCovered(declared, [{ hunter: "Formica", fieldGain: 1_250, returnsAt: at }])).toBe(false);
    expect(huntCovered(declared, [{ hunter: "XaTaK", fieldGain: 1_250, returnsAt: at + 3 * MIN }])).toBe(false);
  });
});
