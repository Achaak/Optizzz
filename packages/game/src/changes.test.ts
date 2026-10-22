import { describe, expect, it } from "vitest";
import {
  allianceChanges,
  allianceState,
  allianceStates,
  describeChange,
  playerChanges,
  playerState,
  type PlayerState,
} from "./changes";
import type { Alliance, Player } from "./exports";

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
  playersCount: 0,
  totalField: 5000,
  totalBuildingScore: 0,
  totalTechnologyScore: 0,
  totalTrophyScore: 0,
  diplomacy: { pacts: [], wars },
});

const state = (fields: Partial<PlayerState> = {}): PlayerState => ({
  pseudo: "Rival",
  alliance: null,
  field: 1000,
  onHoliday: false,
  isBanned: false,
  x: 0,
  y: 0,
  master: null,
  ...fields,
});

describe("playerState", () => {
  it("names the colonizer from the same reading", () => {
    const colon = player(1, "Colon", { masterPlayerId: 2 });
    const master = player(2, "Maître");
    const byId = new Map([colon, master].map((p) => [p.id, p]));
    expect(playerState(colon, byId).master).toEqual({ id: 2, pseudo: "Maître" });
    expect(playerState(master, byId).master).toBeNull();
  });
});

describe("allianceState", () => {
  it("is undefined when nobody carries the tag", () => {
    expect(allianceState("ABC", [player(1, "Seul")], [])).toBeUndefined();
  });

  it("reads the wars declared on it, any case", () => {
    expect(allianceState("ABC", [], [alliance("ABC"), alliance("EVO", ["abc"])])?.warsOn).toEqual(["EVO"]);
  });
});

describe("allianceStates", () => {
  it("gives every alliance the state allianceState gives it", () => {
    const players = [
      player(1, "Rival", { alliance: "ABC" }),
      player(2, "Membre", { alliance: "abc" }),
      player(3, "Seul", { alliance: "SOLO", field: 300 }),
    ];
    const alliances = [alliance("ABC", ["XYZ", "ABC"]), alliance("EVO", ["abc"]), alliance("XYZ")];
    const states = allianceStates(players, alliances);
    for (const tag of ["ABC", "EVO", "XYZ", "SOLO"])
      expect(states.get(tag.toLowerCase())).toEqual(allianceState(tag, players, alliances));
  });
});

describe("playerChanges", () => {
  it("notes a new pseudo, a colonization and a release, by the colonizer's id", () => {
    expect(playerChanges(state(), state({ pseudo: "Nouveau" }))).toEqual([{ kind: "pseudo", from: "Rival" }]);
    expect(playerChanges(state(), state({ master: { id: 2, pseudo: "Maître" } }))).toEqual([
      { kind: "colonized", by: "Maître" },
    ]);
    expect(playerChanges(state({ master: { id: 2, pseudo: "Maître" } }), state())).toEqual([
      { kind: "freed", from: "Maître" },
    ]);
    // The colonizer renamed: same id, no change.
    expect(
      playerChanges(state({ master: { id: 2, pseudo: "Maître" } }), state({ master: { id: 2, pseudo: "Autre" } })),
    ).toEqual([]);
  });

  it("says nothing of the colonizer when a reading did not keep it", () => {
    expect(playerChanges(state({ master: undefined }), state({ master: { id: 2, pseudo: "Maître" } }))).toEqual([]);
  });

  it("notes a ban and its end", () => {
    expect(playerChanges(state(), state({ isBanned: true }))).toEqual([{ kind: "banned" }]);
    expect(playerChanges(state({ isBanned: true }), state())).toEqual([{ kind: "unbanned" }]);
  });

  it("does not note a field move", () => {
    expect(playerChanges(state(), state({ field: 50 }))).toEqual([]);
  });
});

describe("allianceChanges", () => {
  it("notes members, wars and pacts", () => {
    const before = { tag: "ABC", members: { 1: "Rival" }, field: 0, wars: [], warsOn: [], pacts: [] };
    const after = {
      tag: "ABC",
      members: { 2: "Nouveau" },
      field: 0,
      wars: ["XYZ"],
      warsOn: [],
      pacts: [{ tag: "AMI", name: "PNA" }],
    };
    expect(allianceChanges(before, after)).toEqual([
      { kind: "joined", pseudo: "Nouveau" },
      { kind: "left", pseudo: "Rival" },
      { kind: "war", tag: "XYZ", declaredBy: "it" },
      { kind: "pact", tag: "AMI", name: "PNA" },
    ]);
  });
});

describe("describeChange", () => {
  it("says each change after the player's or alliance's name", () => {
    expect(describeChange({ kind: "alliance", from: "ABC", to: "XYZ" })).toBe("a quitté ABC pour XYZ");
    expect(describeChange({ kind: "alliance", from: null, to: "XYZ" })).toBe("a rejoint XYZ");
    expect(describeChange({ kind: "alliance", from: "ABC", to: null })).toBe("a quitté ABC");
    expect(describeChange({ kind: "war", tag: "EVO", declaredBy: "them" })).toBe("EVO lui a déclaré la guerre");
    expect(describeChange({ kind: "pact-ended", tag: "AMI", name: "PNA" })).toBe("pacte (PNA) rompu avec AMI");
    expect(describeChange({ kind: "joined", pseudo: "Nouveau" })).toBe("arrivée de Nouveau");
    expect(describeChange({ kind: "left", pseudo: "Arrivant" })).toBe("départ d'Arrivant");
  });

  it("says the changes the site's Journal adds", () => {
    expect(describeChange({ kind: "new" })).toBe("arrivée sur le serveur");
    expect(describeChange({ kind: "pseudo", from: "Ancien" })).toBe("ancien pseudo : Ancien");
    expect(describeChange({ kind: "colonized", by: "Maître" })).toBe("colonisé par Maître");
    expect(describeChange({ kind: "freed", from: "Ogre" })).toBe("libéré d'Ogre");
    expect(describeChange({ kind: "unbanned" })).toBe("compte débanni");
  });
});
