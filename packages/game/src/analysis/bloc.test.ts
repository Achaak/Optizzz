import { describe, expect, it } from "vitest";
import type { Alliance } from "../exports";
import { blocText, diplomaticBloc } from "./bloc";

const alliance = (
  tag: string,
  totalField: number,
  pacts: [tag: string, kind: string][] = [],
  wars: string[] = [],
): Alliance => ({
  tag,
  name: tag,
  playersCount: 10,
  totalField,
  totalBuildingScore: 0,
  totalTechnologyScore: 0,
  totalTrophyScore: 0,
  diplomacy: { pacts: pacts.map(([other, name]) => ({ tag: other, name, description: "" })), wars },
});

const alliances = [
  // AP lists KISS; Evo lists AP (a pact written on one side only); AP at war with 4O4, BZZ at war with AP.
  alliance("AP", 12_000_000, [["KISS", "PNA"]], ["4O4", "ap"]),
  alliance("KISS", 10_000_000, [["ANGE", "PNA"]]),
  alliance("Evo", 11_000_000, [
    ["ap", "Total "],
    ["Dark", "PNA"],
  ]),
  alliance("ANGE", 3_000_000),
  alliance("Dark", 2_000_000),
  alliance("4O4", 6_000_000, [], ["AP"]),
  alliance("BZZ", 7_000_000, [], ["AP"]),
  alliance("MINE", 6_000_000),
];

describe("diplomaticBloc", () => {
  it("reads the pacts both ways, without the case, and the pacts of its allies on a second ring", () => {
    const bloc = diplomaticBloc("ap", alliances, "MINE");
    expect(bloc?.center.tag).toBe("AP");
    expect(bloc?.pacts.map((pact) => [pact.tag, pact.kind])).toEqual([
      ["Evo", "Total"],
      ["KISS", "PNA"],
    ]);
    expect(bloc?.secondRing.map((other) => [other.tag, other.via])).toEqual([
      ["ANGE", "KISS"],
      ["Dark", "Evo"],
    ]);
  });

  it("lists the wars with who declared them, never against itself", () => {
    expect(diplomaticBloc("AP", alliances, "MINE")?.wars.map((war) => [war.tag, war.side])).toEqual([
      ["BZZ", "them"],
      ["4O4", "both"],
    ]);
  });

  it("weighs the bloc, the alliance and its direct pacts, against mine", () => {
    const bloc = diplomaticBloc("AP", alliances, "MINE");
    expect(bloc).toMatchObject({ field: 33_000_000, ratio: 5.5 });
    expect(bloc && blocText(bloc)).toBe("Avec ses 2 pactes, ce bloc pèse 33M de TDC, 5,5 fois votre alliance.");
  });

  it("has no ratio on my own alliance, nor without one", () => {
    expect(diplomaticBloc("AP", alliances, "AP")?.ratio).toBeNull();
    const alone = diplomaticBloc("ANGE", alliances, null);
    expect(alone?.ratio).toBeNull();
    expect(alone && blocText(alone)).toBe("Avec son pacte, ce bloc pèse 13M de TDC.");
  });

  it("is null for an alliance missing from the export", () => {
    expect(diplomaticBloc("NOPE", alliances, null)).toBeNull();
  });
});
