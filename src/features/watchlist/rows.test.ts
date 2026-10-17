import { describe, expect, it } from "vitest";
import type { Alliance, Player } from "@/data/exports";
import type { WatchEntry } from "@/data/watchlist";
import type { JournalEntry } from "./changes";
import { buildRows } from "./rows";

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

const seen = { version: "202610170900", field: 1000 };
const watched = (id: number, pseudo: string): WatchEntry => ({ kind: "player", id, pseudo, seen });
const banned: JournalEntry = {
  key: "player:2",
  since: "202610170900",
  until: "202610171000",
  change: { kind: "banned" },
};

const base = {
  journal: [banned],
  alliances: [] as Alliance[],
  me: "Moi",
  attackSpeed: 0,
};

describe("buildRows", () => {
  it("puts what is new first, with the field's move, the renames and the distance from my nest", () => {
    const players = [
      player(9, "Moi"),
      player(1, "Calme", { x: 3, y: 4, field: 1020 }),
      player(2, "Banni", { isBanned: true }),
      player(3, "Nouveau", { field: 700 }),
    ];
    const rows = buildRows({
      ...base,
      players,
      entries: [watched(1, "Calme"), watched(2, "Banni"), watched(3, "Ancien"), watched(4, "Disparu")],
    });
    expect(rows.players.map((row) => [row.pseudo, row.isNew])).toEqual([
      ["Banni", true],
      ["Nouveau", true],
      ["Calme", false],
      ["Disparu", false],
    ]);
    const calm = rows.players.find((row) => row.pseudo === "Calme");
    expect(calm).toMatchObject({ distance: 5, travelSeconds: 9038, gap: { delta: 20, notable: false } });
    expect(rows.players.find((row) => row.pseudo === "Nouveau")).toMatchObject({
      formerPseudo: "Ancien",
      gap: { delta: -300, notable: true },
    });
    expect(rows.players.find((row) => row.pseudo === "Disparu")).toMatchObject({ gone: true, field: null });
    expect(rows.players.find((row) => row.pseudo === "Banni")?.changes).toEqual([banned]);
  });

  it("counts an alliance's members from the players export", () => {
    const rows = buildRows({
      ...base,
      players: [player(1, "A", { alliance: "abc" }), player(2, "B", { alliance: "ABC" })],
      alliances: [],
      entries: [{ kind: "alliance", tag: "ABC", seen }],
    });
    expect(rows.alliances[0]).toMatchObject({ tag: "ABC", members: 2, field: 2000, gone: false });
  });
});
