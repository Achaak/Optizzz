import { describe, expect, it } from "vitest";
import type { Alliance, Player } from "@optizzz/game/exports";
import { addChip, highlightedPlayers, initialChips, searchSuggestions, type Chip } from "./selection";

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

  it("offers the players without an alliance as one chip, counting them", () => {
    const [first] = searchSuggestions("sans al", players, alliances, []);
    expect(first).toEqual({ target: { kind: "unaffiliated" }, label: "Sans alliance", detail: "2 joueurs" });
    const chips: Chip[] = [{ kind: "unaffiliated", color: "#000" }];
    expect(searchSuggestions("sans al", players, alliances, chips)).toEqual([]);
  });
});

describe("addChip", () => {
  const palette = ["#a", "#b"];

  it("gives the first colour of the palette no chip uses, and adds a target only once", () => {
    let chips = addChip([], { kind: "alliance", tag: "EVO" }, palette);
    chips = addChip(chips, { kind: "player", id: 3 }, palette);
    chips = addChip(chips, { kind: "alliance", tag: "EVO" }, palette);
    expect(addChip(addChip([], { kind: "unaffiliated" }, palette), { kind: "unaffiliated" }, palette)).toHaveLength(1);
    expect(chips).toEqual([
      { kind: "alliance", tag: "EVO", color: "#a" },
      { kind: "player", id: 3, color: "#b" },
    ]);
    expect(addChip(chips, { kind: "player", id: 4 }, palette).at(-1)?.color).toBe("#a");
  });
});

describe("initialChips", () => {
  const stored: Chip[] = [{ kind: "alliance", tag: "EVO", color: "#123" }];
  const mine = { tag: "ANGE", color: "#mine" };
  const palette = ["#a", "#b"];

  it("starts with my alliance, then keeps what was chosen last", () => {
    expect(initialChips(null, mine, null, palette)).toEqual([{ kind: "alliance", tag: "ANGE", color: "#mine" }]);
    expect(initialChips(stored, mine, null, palette)).toEqual(stored);
    expect(initialChips(null, null, null, palette)).toEqual([]);
  });

  it("opened on a target: my alliance and that target, whatever was chosen last", () => {
    const chips = initialChips(stored, mine, { kind: "player", id: 7 }, palette);
    expect(
      chips.map((chip) => (chip.kind === "player" ? chip.id : chip.kind === "alliance" ? chip.tag : null)),
    ).toEqual(["ANGE", 7]);
    expect(chips.map((chip) => chip.kind)).toEqual(["alliance", "player"]);
    expect(initialChips(stored, mine, { kind: "alliance", tag: "ange" }, palette)).toHaveLength(1);
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

  it("leaves in grey the players a chip's filter rules out, not those of a player's own chip", () => {
    const small = player("Small", { alliance: "EVO", field: 500 });
    const big = player("Big", { alliance: "EVO", field: 20_000 });
    const loner = player("Loner", { field: 100 });
    const chosen = player("Chosen", { field: 100 });
    const filter = { field: { min: 10_000, max: null } };
    const chips: Chip[] = [
      { kind: "alliance", tag: "EVO", color: "#e", filter },
      { kind: "unaffiliated", color: "#u", filter },
      { kind: "player", id: chosen.id, color: "#c" },
    ];
    const highlighted = highlightedPlayers(chips, [small, big, loner, chosen]);
    expect([...highlighted.keys()].map((p) => p.pseudo)).toEqual(["Big", "Chosen"]);
  });

  it("colours the players without an alliance with the « Sans alliance » chip", () => {
    const a = player("A", { alliance: "EVO" });
    const b = player("B");
    const c = player("C");
    const chips: Chip[] = [
      { kind: "unaffiliated", color: "#u" },
      { kind: "player", id: c.id, color: "#c" },
    ];
    const highlighted = highlightedPlayers(chips, [a, b, c, player("D", { isBanned: true })]);
    expect([...highlighted].map(([p, chip]) => [p.pseudo, chip.color])).toEqual([
      ["B", "#u"],
      ["C", "#c"],
    ]);
  });
});
