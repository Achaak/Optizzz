import type { Alliance, Player } from "@optizzz/game/exports";
import { describe, expect, it } from "vitest";
import { decodeMapData, encodeMapData, mapDataSchema } from "./map-data";

const player = (id: number, fields: Partial<Player> = {}): Player => ({
  id,
  pseudo: `J${String(id)}`,
  alliance: null,
  masterPlayerId: null,
  x: id,
  y: id * 2,
  field: 1000 * id,
  grade: null,
  buildingScore: 10,
  technologyScore: 20,
  trophyScore: 0,
  onHoliday: false,
  isBanned: false,
  ...fields,
});

const alliance: Alliance = {
  tag: "ABC",
  name: "Alliance",
  playersCount: 1,
  totalField: 1000,
  totalBuildingScore: 10,
  totalTechnologyScore: 20,
  totalTrophyScore: 0,
  diplomacy: { pacts: [{ tag: "AMI", name: "PNA", description: "" }], wars: ["XYZ"] },
};

describe("map data", () => {
  it("gives the map's players and alliances back, the banned left out", () => {
    const players = [
      player(1, { alliance: "ABC", onHoliday: true }),
      player(2, { masterPlayerId: 1 }),
      player(3, { isBanned: true }),
    ];
    const data = mapDataSchema.parse(JSON.parse(JSON.stringify(encodeMapData("202610221400", players, [alliance]))));
    expect(decodeMapData(data)).toEqual({
      version: "202610221400",
      players: players.slice(0, 2),
      alliances: [alliance],
    });
  });

  it("refuses columns of the wrong type", () => {
    const data = encodeMapData("202610221400", [player(1)], []);
    expect(mapDataSchema.safeParse({ ...data, players: { ...data.players, x: ["1"] } }).success).toBe(false);
  });
});
