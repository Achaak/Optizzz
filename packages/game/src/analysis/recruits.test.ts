import { describe, expect, it } from "vitest";
import type { Player } from "../exports";
import { recruits, type RecruitFilters } from "./recruits";

const player = (id: number, pseudo: string, fields: Partial<Player>): Player => ({
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

const players = [
  // The alliance: its centre is the median of each axis, (10 ; 0), whatever its far member.
  player(1, "Moi", { alliance: "AP", x: 0 }),
  player(2, "Bzz", { alliance: "ap", x: 10 }),
  player(3, "Loin", { alliance: "AP", x: 100 }),
  // +25 % in 7 days, 5 squares from the centre.
  player(10, "Rapide", { field: 1000, x: 13, y: 4, buildingScore: 300, technologyScore: 50 }),
  // Flat, 10 squares away, colonized by a player of XYZ.
  player(11, "Colonie", { field: 500, x: 10, y: 10, masterPlayerId: 20, buildingScore: 100, technologyScore: 200 }),
  // Arrived this week: no growth known.
  player(12, "Nouveau", { field: 700, x: 10, y: 3, buildingScore: 20, technologyScore: 10 }),
  // Left out: on holiday, banned, probably inactive, in an alliance.
  player(13, "Vacances", { onHoliday: true }),
  player(14, "Banni", { isBanned: true }),
  player(15, "Dormeur", {}),
  player(16, "Pris", { alliance: "KISS" }),
  player(20, "Maître", { alliance: "XYZ" }),
];
const weekAgo = new Map([
  [10, 800],
  [11, 500],
  [13, 100],
  [15, 1000],
]);
const none: RecruitFilters = {
  minField: null,
  maxField: null,
  maxDistance: null,
  minBuilding: null,
  maxBuilding: null,
  minTechnology: null,
  maxTechnology: null,
};

describe("recruits", () => {
  it("lists the players without alliance still playing, fastest growth first, the unknown last", () => {
    const result = recruits({ players, tag: "AP", weekAgo, inactive: new Set([15]), filters: none });
    expect(result.center).toEqual({ x: 10, y: 0 });
    expect(result.rows).toEqual([
      { id: 10, pseudo: "Rapide", field: 1000, building: 300, technology: 50, gain: 0.25, distance: 5, master: null },
      {
        id: 11,
        pseudo: "Colonie",
        field: 500,
        building: 100,
        technology: 200,
        gain: 0,
        distance: 10,
        master: { pseudo: "Maître", alliance: "XYZ" },
      },
      { id: 12, pseudo: "Nouveau", field: 700, building: 20, technology: 10, gain: null, distance: 3, master: null },
    ]);
  });

  it("keeps those within the field, Anthill, Technology and distance asked", () => {
    const pseudos = (filters: Partial<RecruitFilters>) =>
      recruits({ players, tag: "AP", weekAgo, inactive: new Set([15]), filters: { ...none, ...filters } }).rows.map(
        (row) => row.pseudo,
      );
    expect(pseudos({ minField: 600 })).toEqual(["Rapide", "Nouveau"]);
    expect(pseudos({ maxField: 700 })).toEqual(["Colonie", "Nouveau"]);
    expect(pseudos({ maxDistance: 5 })).toEqual(["Rapide", "Nouveau"]);
    expect(pseudos({ minBuilding: 100 })).toEqual(["Rapide", "Colonie"]);
    expect(pseudos({ maxBuilding: 100 })).toEqual(["Colonie", "Nouveau"]);
    expect(pseudos({ minTechnology: 50 })).toEqual(["Rapide", "Colonie"]);
    expect(pseudos({ maxTechnology: 50 })).toEqual(["Rapide", "Nouveau"]);
  });

  it("has no centre nor distance for an alliance missing from the export", () => {
    const result = recruits({ players, tag: "NOPE", weekAgo, inactive: new Set([15]), filters: none });
    expect(result.center).toBeNull();
    expect(result.rows[0]?.distance).toBeNull();
  });
});
