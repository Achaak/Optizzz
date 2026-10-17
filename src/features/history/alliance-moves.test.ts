import { describe, expect, it } from "vitest";
import type { Snapshot } from "./api";
import { allianceMoves, moveDays } from "./alliance-moves";

const snapshot = (version: string, alliances: [number, string | null][]): Snapshot => ({
  version,
  players: new Map(),
  alliances: new Map(alliances),
});

describe("allianceMoves", () => {
  it("lists each change of alliance, latest first, between the two exports that frame it", () => {
    const snapshots = [
      snapshot("202610052200", [[1, "ABC"]]),
      snapshot("202610062200", [[1, "ABC"]]),
      snapshot("202610072200", [[1, null]]),
      snapshot("202610082200", [[1, "XYZ"]]),
      snapshot("202610092200", [[1, "ZZZ"]]),
    ];
    expect(allianceMoves(snapshots, 1)).toEqual([
      { from: "XYZ", to: "ZZZ", after: "202610082200", before: "202610092200" },
      { from: null, to: "XYZ", after: "202610072200", before: "202610082200" },
      { from: "ABC", to: null, after: "202610062200", before: "202610072200" },
    ]);
  });

  it("ignores the exports missing the player, and the case of the tags", () => {
    const snapshots = [
      snapshot("202610052200", [[1, "Abc"]]),
      snapshot("202610062200", [[2, "XYZ"]]),
      snapshot("202610072200", [[1, "ABC"]]),
    ];
    expect(allianceMoves(snapshots, 1)).toEqual([]);
  });

  it("ends with the latest export, which can be more recent than the daily ones", () => {
    const snapshots = [snapshot("202610052200", [[1, "ABC"]])];
    expect(allianceMoves(snapshots, 1, { version: "202610061400", alliance: "XYZ" })).toEqual([
      { from: "ABC", to: "XYZ", after: "202610052200", before: "202610061400" },
    ]);
  });
});

describe("moveDays", () => {
  it("names the Paris day between two nightly exports (22 h UTC is midnight in Paris)", () => {
    expect(moveDays({ after: "202610062200", before: "202610072200" })).toBe("07/10");
  });

  it("names the day up to the latest hourly export", () => {
    expect(moveDays({ after: "202610062200", before: "202610071200" })).toBe("07/10");
  });

  it("gives the range when exports are missing", () => {
    expect(moveDays({ after: "202610062200", before: "202610092200" })).toBe("du 07/10 au 09/10");
  });
});
