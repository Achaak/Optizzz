import { describe, expect, it } from "vitest";
import type { Alliance, Player } from "@optizzz/game/exports";
import type { WatchEntry } from "@/data/watchlist";
import { diffStates, fieldGap, fieldLosses, pruneJournal, readState, unseen, type JournalEntry } from "./changes";

const player = (id: number, pseudo: string, fields: Partial<Player> = {}): Player => ({
  id,
  pseudo,
  alliance: null,
  masterPlayerId: null,
  x: 0,
  y: 0,
  field: 1000,
  grade: null,
  buildingScore: 0,
  technologyScore: 0,
  trophyScore: 0,
  onHoliday: false,
  isBanned: false,
  ...fields,
});

const alliance = (tag: string, diplomacy: Partial<Alliance["diplomacy"]> = {}, totalField = 5000): Alliance => ({
  tag,
  name: tag,
  playersCount: 1,
  totalField,
  totalBuildingScore: 0,
  totalTechnologyScore: 0,
  totalTrophyScore: 0,
  diplomacy: { pacts: [], wars: [], ...diplomacy },
});

const seen = { version: "202610170900", field: 1000 };
const rival: WatchEntry = { kind: "player", id: 1, pseudo: "Rival", seen };
const abc: WatchEntry = { kind: "alliance", tag: "abc", seen };
const entries = [rival, abc];

describe("readState", () => {
  it("keeps the watched entries only, with an alliance's members and wars on both sides", () => {
    const players = [
      player(1, "Rival", { alliance: "ABC", x: 3 }),
      player(2, "Membre", { alliance: "Abc" }),
      player(3, "Autre"),
    ];
    const alliances = [
      alliance("ABC", { wars: ["XYZ", "ABC"], pacts: [{ tag: "AMI", name: "PNA ", description: "" }] }),
      alliance("EVO", { wars: ["abc"] }),
    ];
    expect(readState(entries, "202610171000", players, alliances)).toEqual({
      version: "202610171000",
      players: {
        "player:1": {
          pseudo: "Rival",
          alliance: "ABC",
          field: 1000,
          onHoliday: false,
          isBanned: false,
          x: 3,
          y: 0,
          master: null,
        },
      },
      alliances: {
        "alliance:abc": {
          tag: "ABC",
          members: { 1: "Rival", 2: "Membre" },
          field: 5000,
          wars: ["XYZ"],
          warsOn: ["EVO"],
          pacts: [{ tag: "AMI", name: "PNA" }],
        },
      },
    });
  });

  it("leaves out what the exports no longer have", () => {
    expect(readState(entries, "202610171000", [player(9, "Autre")], [])).toEqual({
      version: "202610171000",
      players: {},
      alliances: {},
    });
  });
});

describe("diffStates", () => {
  const before = readState(
    entries,
    "202610171000",
    [player(1, "Rival", { alliance: "ABC" }), player(2, "Parti", { alliance: "ABC" })],
    [alliance("ABC", { wars: ["OLD"], pacts: [{ tag: "AMI", name: "PNA", description: "" }] }), alliance("EVO")],
  );

  it("notes alliance, holiday and ban changes of a player, and an alliance's members, wars and pacts", () => {
    const after = readState(
      entries,
      "202610171100",
      [
        player(1, "Rival", { alliance: "XYZ", onHoliday: true, isBanned: true }),
        player(3, "Arrivé", { alliance: "abc" }),
      ],
      [
        alliance("ABC", { wars: ["NEW"], pacts: [{ tag: "TOT", name: "Total", description: "" }] }),
        alliance("EVO", { wars: ["ABC"] }),
      ],
    );
    const at = { since: "202610171000", until: "202610171100" };
    expect(diffStates(before, after)).toEqual([
      { key: "player:1", ...at, change: { kind: "alliance", from: "ABC", to: "XYZ" } },
      { key: "player:1", ...at, change: { kind: "holiday", on: true } },
      { key: "player:1", ...at, change: { kind: "banned" } },
      { key: "alliance:abc", ...at, change: { kind: "joined", pseudo: "Arrivé" } },
      { key: "alliance:abc", ...at, change: { kind: "left", pseudo: "Rival" } },
      { key: "alliance:abc", ...at, change: { kind: "left", pseudo: "Parti" } },
      { key: "alliance:abc", ...at, change: { kind: "war", tag: "NEW", declaredBy: "it" } },
      { key: "alliance:abc", ...at, change: { kind: "war", tag: "EVO", declaredBy: "them" } },
      { key: "alliance:abc", ...at, change: { kind: "war-ended", tag: "OLD" } },
      { key: "alliance:abc", ...at, change: { kind: "pact", tag: "TOT", name: "Total" } },
      { key: "alliance:abc", ...at, change: { kind: "pact-ended", tag: "AMI", name: "PNA" } },
    ]);
  });

  it("tells what is gone, and nothing about what was not there before", () => {
    const after = readState(entries, "202610171100", [], []);
    expect(diffStates(before, after).map((entry) => [entry.key, entry.change.kind])).toEqual([
      ["player:1", "gone"],
      ["alliance:abc", "gone"],
    ]);
    expect(diffStates(after, before)).toEqual([]);
  });
});

describe("fieldLosses", () => {
  it("gives what each watched entry lost since the last reading, in percent", () => {
    const before = readState([rival], "202610171000", [player(1, "Rival", { field: 1000 })], null);
    const after = readState([rival], "202610171100", [player(1, "Rival", { field: 680 })], null);
    expect(fieldLosses(before, after)).toEqual([{ key: "player:1", name: "Rival", percent: 32 }]);
    expect(fieldLosses(after, before)).toEqual([]);
  });
});

describe("journal", () => {
  const noted = (key: JournalEntry["key"], until: string): JournalEntry => ({
    key,
    since: "202609010000",
    until,
    change: { kind: "banned" },
  });

  it("keeps 30 days of what is still watched", () => {
    const journal = [
      noted("player:1", "202609100000"),
      noted("player:1", "202610100000"),
      noted("player:2", "202610100000"),
    ];
    expect(pruneJournal(journal, ["player:1"], new Date(Date.UTC(2026, 9, 17)))).toEqual([journal[1]]);
  });

  it("tells what was noted after the « seen » mark", () => {
    const journal = [
      noted("player:1", "202610170900"),
      noted("player:1", "202610171000"),
      noted("alliance:abc", "202610171000"),
    ];
    expect(unseen(journal, rival)).toEqual([journal[1]]);
  });
});

describe("fieldGap", () => {
  it("is notable from 5 % up or down", () => {
    expect(fieldGap(1000, 1040)).toEqual({ delta: 40, percent: 4, notable: false });
    expect(fieldGap(1000, 950)).toEqual({ delta: -50, percent: -5, notable: true });
    expect(fieldGap(0, 10)).toBeNull();
  });
});
