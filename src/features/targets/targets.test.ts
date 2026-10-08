import { describe, expect, it } from "vitest";
import s2Html from "./__fixtures__/ennemie-s2.html?raw";
import s5Html from "./__fixtures__/ennemie-s5.html?raw";
import type { Alliance, Player } from "../alliance-map/api";
import { listTargets, readEnemyTable } from "./targets";

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");

describe("readEnemyTable", () => {
  it("reads the live hunting field and the state of each row", () => {
    expect(readEnemyTable(parse(s2Html))).toEqual([
      { pseudo: "Joueur_1", field: 700180, state: "free", master: null },
      { pseudo: "Joueur_3", field: 682149, state: "colonized", master: "Maitre_1" },
      { pseudo: "Joueur_5", field: 525414, state: "banned", master: null },
      { pseudo: "Joueur_7", field: 468167, state: "free", master: null },
      { pseudo: "Joueur_11", field: 421070, state: "colonized", master: "Maitre_5" },
      { pseudo: "Joueur_14", field: 336654, state: "holiday", master: null },
    ]);
  });

  it("reads the beginner protection (« Nouveau »)", () => {
    expect(readEnemyTable(parse(s5Html)).map((row) => row.state)).toEqual(["protected", "protected", "protected"]);
  });

  it("reads nothing on a page without the table", () => {
    expect(readEnemyTable(parse("<div id='centre'></div>"))).toEqual([]);
  });
});

let nextId = 1;
const player = (pseudo: string, fields: Partial<Player>): Player => ({
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

const alliance = (tag: string, diplomacy: Partial<Alliance["diplomacy"]> = {}): Alliance => ({
  tag,
  name: tag,
  playersCount: 1,
  totalField: 0,
  totalBuildingScore: 0,
  totalTechnologyScore: 0,
  totalTrophyScore: 0,
  diplomacy: { pacts: [], wars: [], ...diplomacy },
});

const now = new Date(2026, 9, 8, 10, 0, 0);
const me = player("Moi", { alliance: "MOI", field: 900 });
const baseInput = { me: { pseudo: "Moi", field: 1000 }, attackSpeed: 0, alliances: [alliance("MOI")], live: [] };
const pseudos = (players: Player[], input: Partial<Parameters<typeof listTargets>[0]> = {}) =>
  listTargets({ ...baseInput, players: [me, ...players], ...input }, now).map((target) => target.pseudo);

describe("listTargets", () => {
  it("keeps the players from 50 % to under 300 % of my live field, nearest first", () => {
    const players = [
      player("Loin", { x: 5, y: 12, field: 2999 }),
      player("Proche", { x: 3, y: 4, field: 500 }),
      player("TropGros", { x: 1, y: 0, field: 3000 }),
      player("TropPetit", { x: 1, y: 0, field: 499 }),
    ];
    expect(pseudos(players)).toEqual(["Proche", "Loin"]);
  });

  it("leaves out me, my alliance and the banned", () => {
    const players = [player("Allie", { alliance: "MOI" }), player("Banni", { isBanned: true }), player("Libre", {})];
    expect(pseudos(players)).toEqual(["Libre"]);
  });

  it("tells the distance, the trip, the arrival and the most a win takes", () => {
    const [target] = listTargets({ ...baseInput, players: [me, player("Cible", { x: 3, y: 4, field: 2345 })] }, now);
    expect(target).toMatchObject({
      distance: 5,
      travelSeconds: 9039,
      arrival: new Date(2026, 9, 8, 12, 30, 39),
      ratio: 2.345,
      takeMax: 469,
    });
    const faster = listTargets({ ...baseInput, attackSpeed: 3, players: [me, player("Cible", { x: 3, y: 4 })] }, now);
    expect(faster[0]?.travelSeconds).toBe(6589);
  });

  it("marks pacts and wars, whichever side declared the war, but not a war on oneself", () => {
    const alliances = [
      alliance("MOI", { pacts: [{ tag: "AMI", name: "PNA ", description: "6 mois" }], wars: ["Rival"] }),
      alliance("AMI"),
      alliance("RIVAL"),
      alliance("HOSTILE", { wars: ["moi", "HOSTILE"] }),
      alliance("NEUTRE", { wars: ["NEUTRE"] }),
    ];
    const players = ["AMI", "RIVAL", "HOSTILE", "NEUTRE"].map((tag, i) => player(tag, { alliance: tag, x: i }));
    const targets = listTargets({ ...baseInput, alliances, players: [me, ...players] }, now);
    expect(targets.map((target) => [target.pseudo, target.diplomacy])).toEqual([
      ["AMI", { kind: "pact", name: "PNA", description: "6 mois" }],
      ["RIVAL", { kind: "war" }],
      ["HOSTILE", { kind: "war" }],
      ["NEUTRE", null],
    ]);
  });

  it("names who colonized a player, and tells holidays", () => {
    const master = player("Maitre", { field: 100000 });
    const players = [
      master,
      player("Colonie", { masterPlayerId: master.id }),
      player("Absent", { onHoliday: true, x: 1 }),
    ];
    const targets = listTargets({ ...baseInput, players: [me, ...players] }, now);
    expect(targets.map((target) => [target.pseudo, target.state, target.master])).toEqual([
      ["Colonie", "colonized", "Maitre"],
      ["Absent", "holiday", null],
    ]);
  });

  it("prefers the game's live field and state to the export", () => {
    const players = [player("Protege", { field: 100 }), player("Grossi", { field: 1000 })];
    const live = [
      { pseudo: "Protege", field: 1200, state: "protected" as const, master: null },
      { pseudo: "Grossi", field: 5000, state: "free" as const, master: null },
    ];
    const targets = listTargets({ ...baseInput, live, players: [me, ...players] }, now);
    expect(targets.map((target) => [target.pseudo, target.field, target.state])).toEqual([
      ["Protege", 1200, "protected"],
    ]);
  });

  it("tells who can be attacked now, and who can attack me back", () => {
    const alliances = [alliance("MOI", { pacts: [{ tag: "AMI", name: "PNA", description: "" }] }), alliance("AMI")];
    const players = [
      player("Petit", { field: 600, x: 1 }),
      player("Gros", { field: 2500, x: 2 }),
      player("Ami", { alliance: "AMI", x: 3 }),
      player("Absent", { onHoliday: true, x: 4 }),
    ];
    const targets = listTargets({ ...baseInput, alliances, players: [me, ...players] }, now);
    expect(targets.map((target) => [target.pseudo, target.attackableNow, target.canAttackMe])).toEqual([
      ["Petit", true, true],
      ["Gros", true, false],
      ["Ami", false, true],
      ["Absent", false, true],
    ]);
  });
});
