import { describe, expect, it } from "vitest";
import type { Alliance, Player } from "@/data/exports";
import {
  addChip,
  highlightedPlayers,
  initialChips,
  MY_ALLIANCE_COLOR,
  searchSuggestions,
  type Chip,
} from "./selection";

let nextId = 1;
const player = (pseudo: string, fields: Partial<Player> = {}): Player => ({
  id: nextId++,
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

const alliance = (tag: string, name = tag, playersCount = 1): Alliance => ({
  tag,
  name,
  playersCount,
  totalField: 0,
  totalBuildingScore: 0,
  totalTechnologyScore: 0,
  totalTrophyScore: 0,
  diplomacy: { pacts: [], wars: [] },
});

describe("searchSuggestions", () => {
  const players = [
    player("Élodie", { alliance: "ANGE" }),
    player("Melodie"),
    player("Banni", { isBanned: true }),
    player("Angelo"),
  ];
  const alliances = [alliance("ANGE", "Les anges", 12), alliance("Evo", "Évolution")];

  it("ignores case and accents, prefixes first", () => {
    const labels = searchSuggestions("elod", players, alliances, []).map((s) => s.label);
    expect(labels).toEqual(["Élodie", "Melodie"]);
  });

  it("finds alliances by tag or name, and players, the banned left out", () => {
    expect(searchSuggestions("ange", players, alliances, []).map((s) => s.target)).toEqual([
      { kind: "alliance", tag: "ANGE" },
      { kind: "player", id: players[3]?.id },
    ]);
    expect(searchSuggestions("evolu", players, alliances, []).map((s) => s.label)).toEqual(["Evo"]);
    expect(searchSuggestions("ban", players, alliances, [])).toEqual([]);
  });

  it("leaves out what is already chosen, and gives at most `limit`", () => {
    const chips: Chip[] = [{ kind: "alliance", tag: "ANGE", color: "#000" }];
    expect(searchSuggestions("ange", players, alliances, chips).map((s) => s.label)).toEqual(["Angelo"]);
    expect(searchSuggestions("e", players, alliances, [], 2)).toHaveLength(2);
    expect(searchSuggestions("  ", players, alliances, [])).toEqual([]);
  });
});

describe("addChip", () => {
  const palette = ["#a", "#b"];

  it("gives the first colour of the palette no chip uses, and adds a target only once", () => {
    let chips = addChip([], { kind: "alliance", tag: "EVO" }, palette);
    chips = addChip(chips, { kind: "player", id: 3 }, palette);
    chips = addChip(chips, { kind: "alliance", tag: "EVO" }, palette);
    expect(chips).toEqual([
      { kind: "alliance", tag: "EVO", color: "#a" },
      { kind: "player", id: 3, color: "#b" },
    ]);
    expect(addChip(chips, { kind: "player", id: 4 }, palette).at(-1)?.color).toBe("#a");
  });
});

describe("initialChips", () => {
  const stored: Chip[] = [{ kind: "alliance", tag: "EVO", color: "#123" }];

  it("starts with my alliance, then keeps what was chosen last", () => {
    expect(initialChips(null, "ANGE", null)).toEqual([{ kind: "alliance", tag: "ANGE", color: MY_ALLIANCE_COLOR }]);
    expect(initialChips(stored, "ANGE", null)).toEqual(stored);
    expect(initialChips(null, null, null)).toEqual([]);
  });

  it("opened on a target: my alliance and that target, whatever was chosen last", () => {
    const chips = initialChips(stored, "ANGE", { kind: "player", id: 7 });
    expect(chips.map((chip) => (chip.kind === "player" ? chip.id : chip.tag))).toEqual(["ANGE", 7]);
    expect(chips.map((chip) => chip.kind)).toEqual(["alliance", "player"]);
    expect(initialChips(stored, "ANGE", { kind: "alliance", tag: "ange" })).toHaveLength(1);
  });
});

describe("highlightedPlayers", () => {
  it("colours each chosen player by its chip, a player's own chip over its alliance's, banned left out", () => {
    const a = player("A", { alliance: "EVO" });
    const b = player("B", { alliance: "EVO" });
    const banned = player("C", { alliance: "evo", isBanned: true });
    const chips: Chip[] = [
      { kind: "player", id: b.id, color: "#b" },
      { kind: "alliance", tag: "Evo", color: "#e" },
    ];
    const highlighted = highlightedPlayers(chips, [a, b, banned, player("D")]);
    expect([...highlighted].map(([p, chip]) => [p.pseudo, chip.color])).toEqual([
      ["A", "#e"],
      ["B", "#b"],
    ]);
  });
});
