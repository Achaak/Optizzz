import { describe, expect, it } from "vitest";
import { allianceColonies } from "./colonies";

const player = (id: number, pseudo: string, alliance: string | null, masterPlayerId: number | null = null) => ({
  id,
  pseudo,
  alliance,
  masterPlayerId,
});

const players = [
  player(1, "Lunaire", "AP"),
  player(2, "Myrmi", "ap", 10),
  player(3, "Bzz", "AP", 1),
  player(4, "Pixel", "BZZ", 1),
  player(5, "Nano", null, 4),
  player(10, "Grop", "4O4"),
  player(11, "Kenzo", null, 10),
];

describe("allianceColonies", () => {
  it("sorts the colonies touching the alliance: taken from outside, held outside, between members", () => {
    const colonies = allianceColonies("AP", players);
    const pairs = (links: typeof colonies.internal) => links.map((link) => [link.master.pseudo, link.colony.pseudo]);
    expect(pairs(colonies.colonizedFromOutside)).toEqual([["Grop", "Myrmi"]]);
    expect(pairs(colonies.heldOutside)).toEqual([["Lunaire", "Pixel"]]);
    expect(pairs(colonies.internal)).toEqual([["Lunaire", "Bzz"]]);
    expect(colonies.colonizedFromOutside[0]?.master.alliance).toBe("4O4");
  });

  it("draws the chains of more than one level from their top master, counting its other colonies", () => {
    expect(allianceColonies("AP", players).chains).toEqual([
      {
        pseudo: "Lunaire",
        alliance: "AP",
        // Bzz has no colony of its own: counted, not drawn.
        more: 1,
        colonies: [
          {
            pseudo: "Pixel",
            alliance: "BZZ",
            more: 0,
            colonies: [{ pseudo: "Nano", alliance: null, more: 0, colonies: [] }],
          },
        ],
      },
    ]);
  });

  it("has no chain when every colony is one level deep", () => {
    expect(allianceColonies("4O4", players).chains).toEqual([]);
  });
});
