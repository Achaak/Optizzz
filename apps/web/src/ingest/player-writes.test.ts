import { describe, expect, it } from "vitest";
import type { Player } from "@optizzz/game/exports";
import { playerWrites } from "./player-writes";

const player = (id: number, fields: Partial<Player> = {}): Player => ({
  id,
  pseudo: `p${String(id)}`,
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

describe("playerWrites", () => {
  it("writes nothing when nobody changed", () => {
    expect(playerWrites([player(1), player(2)], [player(1), player(2)])).toEqual({ upserts: [], removed: [] });
  });

  it("writes the new players and the ones with any field changed", () => {
    const writes = playerWrites(
      [player(1), player(2), player(3)],
      [player(1), player(2, { field: 1200 }), player(3, { alliance: "ABC" }), player(4)],
    );
    expect(writes.upserts.map((p) => p.id)).toEqual([2, 3, 4]);
    expect(writes.removed).toEqual([]);
  });

  it("removes the players gone from the export", () => {
    expect(playerWrites([player(1), player(2)], [player(2)])).toEqual({ upserts: [], removed: [1] });
  });

  it("notices a change of every stored field", () => {
    const changes: Partial<Player>[] = [
      { pseudo: "other" },
      { alliance: "X" },
      { masterPlayerId: 9 },
      { x: 1 },
      { y: 1 },
      { field: 1 },
      { grade: "Reine" },
      { buildingScore: 1 },
      { technologyScore: 1 },
      { trophyScore: 1 },
      { onHoliday: true },
      { isBanned: true },
    ];
    for (const change of changes) expect(playerWrites([player(1)], [player(1, change)]).upserts).toHaveLength(1);
  });
});
