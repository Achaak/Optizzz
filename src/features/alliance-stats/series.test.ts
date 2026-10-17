import { describe, expect, it } from "vitest";
import type { Alliance } from "@/data/exports";
import type { AllianceScores, AllianceSnapshot } from "./api";
import { allianceSeries, findAlliance, membersTotals, rankOf, shares, suggestions } from "./series";

const scores = (field: number, members = 10): AllianceScores => ({
  members,
  field,
  building: 100,
  technology: 50,
  trophy: 0,
});

const snapshot = (version: string, entries: [string, AllianceScores][]): AllianceSnapshot => ({
  version,
  alliances: new Map(entries),
});

const history = [
  snapshot("202610052200", [
    ["XYZ", scores(1000, 20)],
    ["V", scores(5000)],
  ]),
  snapshot("202610062200", [
    ["XYZ", scores(1200, 24)],
    ["V", scores(4000)],
  ]),
];

describe("findAlliance", () => {
  it("finds an alliance whatever the case of its tag", () => {
    expect(findAlliance(history[0]?.alliances ?? new Map(), "xyz")?.field).toBe(1000);
    expect(findAlliance(history[0]?.alliances ?? new Map(), "nope")).toBeUndefined();
  });
});

describe("allianceSeries", () => {
  it("gives the alliance's total at each export, then the live value", () => {
    const live = { time: new Date("2026-10-07T08:00:00Z"), scores: { field: 1300 } };
    expect(allianceSeries(history, "XYZ", "field", false, live)).toEqual([
      { time: Date.UTC(2026, 9, 5, 22), value: 1000, live: false },
      { time: Date.UTC(2026, 9, 6, 22), value: 1200, live: false },
      { time: Date.UTC(2026, 9, 7, 8), value: 1300, live: true },
    ]);
  });

  it("divides by the members of the same moment for the average", () => {
    const live = { time: new Date("2026-10-07T08:00:00Z"), scores: { field: 1250, members: 25 } };
    expect(allianceSeries(history, "XYZ", "field", true, live).map((point) => point.value)).toEqual([50, 50, 50]);
  });

  it("draws the production ceiling from the TDC: 48 a day per cm²", () => {
    expect(allianceSeries(history, "XYZ", "production", false).map((point) => point.value)).toEqual([48_000, 57_600]);
    expect(allianceSeries(history, "XYZ", "production", true).map((point) => point.value)).toEqual([2_400, 2_400]);
  });

  it("keeps the members count as it is, average or not", () => {
    expect(allianceSeries(history, "XYZ", "members", true).map((point) => point.value)).toEqual([20, 24]);
  });

  it("gives no live average without the live members count", () => {
    const live = { time: new Date(), scores: { field: 1300 } };
    expect(allianceSeries(history, "XYZ", "field", true, live)).toHaveLength(2);
  });

  it("stops where the alliance leaves the export", () => {
    const gone = [...history, snapshot("202610072200", [["XYZ", scores(1300)]])];
    expect(allianceSeries(gone, "V", "field", false)).toHaveLength(2);
  });
});

describe("rankOf", () => {
  it("ranks the alliance among all those of the export, best first", () => {
    const alliances = history[1]?.alliances ?? new Map<string, AllianceScores>();
    expect(rankOf(alliances, "V", "field", false)).toBe(1);
    expect(rankOf(alliances, "xyz", "field", false)).toBe(2);
    // Per member, XYZ (50) is behind V (400).
    expect(rankOf(alliances, "XYZ", "field", true)).toBe(2);
    expect(rankOf(alliances, "NOPE", "field", false)).toBeNull();
  });
});

const exported = (tag: string, pacts: string[] = [], wars: string[] = []): Alliance => ({
  tag,
  name: `Alliance ${tag}`,
  playersCount: 10,
  totalField: 0,
  totalBuildingScore: 0,
  totalTechnologyScore: 0,
  totalTrophyScore: 0,
  diplomacy: { pacts: pacts.map((pact) => ({ tag: pact, name: "PNA", description: "" })), wars },
});

describe("suggestions", () => {
  const latest = snapshot("202610062200", [
    ["A", scores(9000)],
    ["B", scores(8000)],
    ["C", scores(7000)],
    ["ME", scores(6000)],
    ["D", scores(5000)],
    ["E", scores(4000)],
    ["F", scores(3000)],
  ]);

  it("suggests pacts, wars with who declared them, and the neighbours in the ranking", () => {
    const alliances = [
      exported("ME", ["F"], ["me", "A", "G"]),
      exported("A"),
      exported("B"),
      exported("C"),
      exported("D"),
      exported("E", [], ["Me"]),
      exported("G", [], ["ME"]),
      exported("F"),
    ];
    expect(suggestions(alliances, latest, "ME", "field")).toEqual([
      { tag: "F", reason: "pact" },
      { tag: "A", reason: "war", declaredBy: "us" },
      { tag: "G", reason: "war", declaredBy: "both" },
      { tag: "E", reason: "war", declaredBy: "them" },
      { tag: "B", reason: "neighbour" },
      { tag: "C", reason: "neighbour" },
      { tag: "D", reason: "neighbour" },
    ]);
  });
});

describe("shares", () => {
  it("sorts the members by value with their part of the total", () => {
    expect(
      shares(
        new Map([
          ["Petit", 25],
          ["Gros", 75],
        ]),
      ),
    ).toEqual([
      { pseudo: "Gros", value: 75, share: 75 },
      { pseudo: "Petit", value: 25, share: 25 },
    ]);
  });

  it("gives no part when the total is zero", () => {
    expect(shares(new Map([["Rien", 0]]))).toEqual([{ pseudo: "Rien", value: 0, share: null }]);
  });
});

describe("membersTotals", () => {
  it("adds up the members table, without trophies", () => {
    const members = new Map([
      ["A", { field: 100, building: 10, technology: 5 }],
      ["B", { field: 50, building: 20, technology: 5 }],
    ]);
    expect(membersTotals(members)).toEqual({ members: 2, field: 150, building: 30, technology: 10 });
  });
});
