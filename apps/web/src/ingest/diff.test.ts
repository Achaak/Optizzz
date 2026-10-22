import { describe, expect, it } from "vitest";
import type { Alliance, Player } from "@optizzz/game/exports";
import { diffReadings, type Reading } from "./diff";

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

const alliance = (tag: string, wars: string[] = []): Alliance => ({
  tag,
  name: tag,
  playersCount: 1,
  totalField: 1000,
  totalBuildingScore: 0,
  totalTechnologyScore: 0,
  totalTrophyScore: 0,
  diplomacy: { pacts: [], wars },
});

const reading = (players: Player[], alliances: Alliance[] = []): Reading => ({
  version: "202610221000",
  players,
  alliances,
});

describe("diffReadings", () => {
  it("notes the players who arrive, leave and change, named as the new reading names them", () => {
    const before = reading([player(1, "Rival"), player(2, "Parti"), player(4, "Maître")]);
    const after = reading([player(1, "Renommé", { masterPlayerId: 4 }), player(3, "Arrivé"), player(4, "Maître")]);
    expect(diffReadings(before, after)).toEqual([
      { playerId: 1, tag: null, name: "Renommé", change: { kind: "pseudo", from: "Rival" } },
      { playerId: 1, tag: null, name: "Renommé", change: { kind: "colonized", by: "Maître" } },
      { playerId: 3, tag: null, name: "Arrivé", change: { kind: "new" } },
      { playerId: 2, tag: null, name: "Parti", change: { kind: "gone" } },
    ]);
  });

  it("notes the alliances created and gone, their members and their wars", () => {
    const before = reading(
      [player(1, "Rival", { alliance: "ABC" }), player(2, "Seul", { alliance: "OLD" })],
      [alliance("ABC"), alliance("OLD")],
    );
    const after = reading(
      [player(1, "Rival", { alliance: "NEW" }), player(2, "Seul")],
      [alliance("ABC", ["NEW"]), alliance("NEW")],
    );
    expect(diffReadings(before, after).filter((note) => note.tag !== null)).toEqual([
      { playerId: null, tag: "ABC", name: "ABC", change: { kind: "left", pseudo: "Rival" } },
      { playerId: null, tag: "ABC", name: "ABC", change: { kind: "war", tag: "NEW", declaredBy: "it" } },
      { playerId: null, tag: "NEW", name: "NEW", change: { kind: "new" } },
      { playerId: null, tag: "OLD", name: "OLD", change: { kind: "gone" } },
    ]);
  });

  it("notes nothing when nothing but the field moved", () => {
    expect(diffReadings(reading([player(1, "Rival")]), reading([player(1, "Rival", { field: 5 })]))).toEqual([]);
  });
});
