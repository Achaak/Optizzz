import { describe, expect, it } from "vitest";
import type { WatchEntry } from "@/data/watchlist";
import type { JournalEntry, WatchState } from "./changes";
import { summarize } from "./summary";

const now = new Date(Date.UTC(2026, 9, 17, 12, 30));
const seen = { version: "202610170900", field: 1000 };
const entries: WatchEntry[] = [
  { kind: "player", id: 1, pseudo: "Rival", seen },
  { kind: "player", id: 2, pseudo: "Calme", seen },
  { kind: "alliance", tag: "abc", seen },
];
const player = (pseudo: string, field: number) => ({
  pseudo,
  alliance: null,
  field,
  onHoliday: false,
  isBanned: false,
  x: 0,
  y: 0,
});
const state: WatchState = {
  version: "202610171100",
  players: { "player:1": player("Rival", 1000), "player:2": player("Calme", 1010) },
  alliances: { "alliance:abc": { tag: "ABC", members: {}, field: 800, wars: [], warsOn: [], pacts: [] } },
};
const journal: JournalEntry[] = [
  { key: "player:1", since: "202610170800", until: "202610170900", change: { kind: "banned" } },
  {
    key: "player:1",
    since: "202610171000",
    until: "202610171100",
    change: { kind: "alliance", from: "ABC", to: "XYZ" },
  },
];

describe("summarize", () => {
  it("counts what is new (a change or the field moved enough) and gives the latest changes", () => {
    expect(summarize(entries, journal, state, now)).toEqual({
      newCount: 2,
      latest: ["Rival : a quitté ABC pour XYZ (aujourd'hui 13 h 00)"],
    });
  });

  it("is empty before the first reading", () => {
    expect(summarize(entries, [], null, now)).toEqual({ newCount: 0, latest: [] });
  });
});
