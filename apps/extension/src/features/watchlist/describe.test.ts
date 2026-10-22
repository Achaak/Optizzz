import { describe, expect, it } from "vitest";
import type { JournalEntry } from "./changes";
import { describeWhen, watchNotice } from "./describe";

const now = new Date(Date.UTC(2026, 9, 17, 12, 30));

describe("describeWhen", () => {
  it("dates by the second reading an hour apart, and gives the range after a gap", () => {
    expect(describeWhen({ since: "202610171000", until: "202610171100" }, now)).toBe("aujourd'hui 13 h 00");
    expect(describeWhen({ since: "202610162000", until: "202610170600" }, now)).toBe(
      "entre hier 22 h 00 et aujourd'hui 8 h 00",
    );
    expect(describeWhen({ since: "202610162200", until: "202610170600" }, now)).toBe(
      "aujourd'hui entre 0 h 00 et 8 h 00",
    );
  });
});

describe("watchNotice", () => {
  const journal: JournalEntry[] = [
    {
      key: "alliance:abc",
      since: "202610171000",
      until: "202610171100",
      change: { kind: "war", tag: "XYZ", declaredBy: "them" },
    },
    { key: "player:1", since: "202610171000", until: "202610171100", change: { kind: "banned" } },
  ];
  const input = {
    server: "S5",
    journal,
    losses: [
      { key: "player:1" as const, name: "Rival", percent: 32.4 },
      { key: "player:2" as const, name: "Petit", percent: 8 },
    ],
    names: { "alliance:abc": "ABC", "player:1": "Rival" },
    lossPercent: 20,
  };

  it("sums up, in one line, what the player switched on", () => {
    expect(watchNotice({ ...input, enabled: { "watch-field": true, "watch-war": true } })).toBe(
      "Suivis S5 : Rival −32 % de TDC · ABC : XYZ lui a déclaré la guerre",
    );
  });

  it("sends nothing when nothing switched on happened", () => {
    expect(watchNotice({ ...input, enabled: { "watch-pact": true } })).toBeNull();
  });
});
