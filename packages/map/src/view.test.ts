import { describe, expect, it } from "vitest";
import type { Player } from "@optizzz/game/exports";
import type { Chip } from "./selection";
import { allianceCenters, showPseudos, sortRows, tableRows } from "./view";

let nextId = 1;
const player = (pseudo: string, x: number, y: number, fields: Partial<Player> = {}): Player => ({
  id: nextId++,
  pseudo,
  alliance: null,
  masterPlayerId: null,
  x,
  y,
  field: 1000,
  grade: null,
  buildingScore: 0,
  technologyScore: 0,
  trophyScore: 0,
  onHoliday: false,
  isBanned: false,
  ...fields,
});

const evo: Chip = { kind: "alliance", tag: "EVO", color: "#e" };

describe("showPseudos", () => {
  const view = { x: [0, 10] as const, y: [0, 10] as const };

  it("writes pseudos while few chosen players are in view", () => {
    const inside = Array.from({ length: 5 }, (_, i) => ({ x: i, y: i }));
    const outside = Array.from({ length: 100 }, () => ({ x: 50, y: 50 }));
    expect(showPseudos(view, [...inside, ...outside], 40)).toBe(true);
    expect(
      showPseudos(
        view,
        Array.from({ length: 41 }, () => ({ x: 1, y: 1 })),
        40,
      ),
    ).toBe(false);
  });
});

describe("allianceCenters", () => {
  it("puts each chosen alliance's tag at the middle of its members", () => {
    const highlighted = new Map<Player, Chip>([
      [player("A", 0, 0, { alliance: "EVO" }), evo],
      [player("B", 10, 4, { alliance: "EVO" }), evo],
      [player("Seul", 30, 30), { kind: "player", id: 0, color: "#s" }],
    ]);
    expect(allianceCenters(highlighted)).toEqual([{ tag: "EVO", color: "#e", x: 5, y: 2 }]);
  });
});

describe("table rows", () => {
  const me = player("Moi", 0, 0);
  const near = player("Proche", 3, 4, { field: 50 });
  const far = player("Loin", 30, 40, { field: 500 });
  const highlighted = new Map<Player, Chip>([
    [far, evo],
    [me, evo],
    [near, evo],
  ]);

  it("lists the chosen players but the reference, nearest first, with the trip from the reference", () => {
    const rows = tableRows(me, highlighted, { level: 0, estimated: true });
    expect(rows.map((row) => [row.player.pseudo, row.distance])).toEqual([
      ["Proche", 5],
      ["Loin", 50],
    ]);
    expect(rows[0]?.trip).toMatchObject({ estimated: true });
    expect(rows[0]?.trip.seconds).toBeLessThan(rows[1]?.trip.seconds ?? 0);
  });

  it("sorts by a column, either way", () => {
    const rows = tableRows(me, highlighted, { level: 0, estimated: false });
    expect(sortRows(rows, "field", true).map((row) => row.player.pseudo)).toEqual(["Loin", "Proche"]);
    expect(sortRows(rows, "pseudo", false).map((row) => row.player.pseudo)).toEqual(["Loin", "Proche"]);
    expect(sortRows(rows, "distance", true).map((row) => row.player.pseudo)).toEqual(["Loin", "Proche"]);
  });
});
