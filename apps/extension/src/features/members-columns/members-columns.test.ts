import { describe, expect, it } from "vitest";
import type { Player } from "@optizzz/game/exports";
import membersHtml from "@optizzz/game/pages/__fixtures__/members.html?raw";
import {
  addColumnPicker,
  addMembersColumns,
  COLUMN_CLASS,
  HIDDEN_CLASS,
  hideMembersColumns,
  ME_CLASS,
  removeMembersColumns,
  type MembersColumnsContext,
} from "./mount";
import { rolesOfMembers } from "./roles";
import { tripsFrom } from "./trips";

let nextId = 1;
const player = (pseudo: string, x: number, y: number, fields: Partial<Player> = {}): Player => ({
  id: nextId++,
  pseudo,
  alliance: "MOI",
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

// Measured on a profile: (55;28) → (35;8) with Attack Speed 3 takes 10H 1m 2s (docs/research/temps-de-trajet.md).
const me = player("Me", 55, 28);
const alpha = player("Alpha", 35, 8);
const players = [me, alpha];
const now = new Date("2026-10-15T08:00:00Z");

const membersPage = () => {
  const doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = membersHtml;
  return doc;
};
const table = (doc: Document) => doc.querySelector<HTMLTableElement>("#tabMembresAlliance");
/** Text of the cells of one Optizzz column, header first: 0 for the first one added. */
const column = (doc: Document, which = 0) =>
  [...(table(doc)?.rows ?? [])].map((row) => row.querySelectorAll(`.${COLUMN_CLASS}`)[which]?.textContent ?? "");
const pseudos = (doc: Document) =>
  [...(table(doc)?.rows ?? [])].slice(1).map((row) => row.cells[3]?.textContent.trim());
const header = (doc: Document, which = 0) => doc.querySelectorAll<HTMLElement>(`th.${COLUMN_CLASS}`)[which];
const clickHeader = (doc: Document, which = 0) => header(doc, which)?.querySelector("a")?.click();

const withTrips = (): MembersColumnsContext => ({ myPseudo: "Me", trips: { byPseudo: tripsFrom(players, "Me", 3) } });

describe("tripsFrom", () => {
  it("gives my trip to every other player, by lowercase nickname", () => {
    const trips = tripsFrom(players, "me", 3);
    expect(trips.has("me")).toBe(false);
    expect(trips.get("alpha")).toEqual({ distance: Math.hypot(20, 20), travelSeconds: 36_062 });
  });

  it("is empty when I am not in the export yet", () => {
    expect(tripsFrom(players, "Nouveau", 3).size).toBe(0);
  });
});

describe("rolesOfMembers", () => {
  it("gives my alliance's chain roles by lowercase nickname, with the live fields", () => {
    const stranger = player("Autre", 0, 0, { alliance: "EUX" });
    const roles = rolesOfMembers([me, alpha, stranger], "me", new Map([["Me", 9000]]), { roles: null, styles: {} });
    expect([...roles.keys()]).toEqual(["me", "alpha"]);
    // Proposed from the fields: Me now the biggest.
    expect(roles.get("me")?.role).toEqual({ kind: "granary", rank: 1 });
  });

  it("is empty when I am in no alliance", () => {
    expect(
      rolesOfMembers([player("Seul", 0, 0, { alliance: null })], "Seul", new Map(), { roles: null, styles: {} }).size,
    ).toBe(0);
  });
});

describe("addMembersColumns", () => {
  it("adds a « Trajet » column: the trip to each member, nothing on my row, « ? » when not in the export", () => {
    const doc = membersPage();
    addMembersColumns(doc, withTrips(), now);
    expect(column(doc).slice(0, 4)).toEqual(["Trajet", "10 h 02", "vous", "?"]);
    const alphaCell = doc.querySelectorAll<HTMLTableCellElement>(`td.${COLUMN_CLASS}`)[0];
    expect(alphaCell?.title).toBe("Distance : 28,3 · arrivée en partant maintenant : aujourd'hui 20 h 01");
  });

  it("adds the columns once", () => {
    const doc = membersPage();
    addMembersColumns(doc, withTrips(), now);
    addMembersColumns(doc, withTrips(), now);
    expect(doc.querySelectorAll(`th.${COLUMN_CLASS}`)).toHaveLength(1);
  });

  it("says on the header why the trips are missing", () => {
    const doc = membersPage();
    addMembersColumns(doc, { myPseudo: "Me", trips: { byPseudo: null, missing: "Niveaux inconnus." } }, now);
    expect(header(doc)?.title).toBe("Niveaux inconnus.");
    expect(column(doc).slice(1).filter(Boolean)).toEqual(["vous"]);
  });

  it("sorts by trip, nearest first then farthest first, the unknown always last", () => {
    const doc = membersPage();
    addMembersColumns(doc, withTrips(), now);
    clickHeader(doc);
    expect(pseudos(doc).slice(0, 3)).toEqual(["Me", "Alpha", "Gros"]);
    expect(header(doc)?.classList.contains("forwardSort")).toBe(true);
    clickHeader(doc);
    expect(pseudos(doc).slice(0, 2)).toEqual(["Alpha", "Me"]);
    expect(pseudos(doc).at(-1)).not.toBe("Alpha");
    expect(header(doc)?.classList.contains("reverseSort")).toBe(true);
  });

  it("adds « Aujourd'hui » and « 7 j »: the live field against midnight and a week ago, « — » when unknown", () => {
    const doc = membersPage();
    addMembersColumns(
      doc,
      {
        myPseudo: "Me",
        evolution: new Map([
          ["alpha", { live: 1100, midnight: 1000, weekAgo: 1250 }],
          ["me", { live: 500, midnight: 500, weekAgo: null }],
        ]),
      },
      now,
    );
    // The percentage in the tooltip: on the line, it pushed « 7 j » out of the game's frame.
    // « Auj. »: the game's look writes the headers in capitals, « AUJOURD'HUI » made the column twice as wide.
    expect(column(doc, 0).slice(0, 4)).toEqual(["Auj.", "+100 ▲", "0", "—"]);
    expect(column(doc, 1).slice(0, 4)).toEqual(["7 j", "−150 ▼", "—", "—"]);
    const alphaToday = doc.querySelectorAll<HTMLTableCellElement>(`td.${COLUMN_CLASS}`)[0];
    expect(alphaToday?.title).toBe("+10 % depuis l'export de minuit (1 000 → 1 100)");
  });

  it("writes the moves short, whatever « Nombres arrondis » says, the exact numbers in the tooltip", () => {
    const doc = membersPage();
    addMembersColumns(
      doc,
      { myPseudo: "Me", evolution: new Map([["alpha", { live: 2_989_391, midnight: 2_697_223, weekAgo: 1_820_719 }]]) },
      now,
    );
    expect(column(doc, 0)[1]).toBe("+292K ▲");
    expect(column(doc, 1)[1]).toBe("+1,17M ▲");
    const alphaWeek = doc.querySelectorAll<HTMLTableCellElement>(`td.${COLUMN_CLASS}`)[1];
    expect(alphaWeek?.title).toBe("+64,2 % depuis l'export de minuit il y a 7 jours (1 820 719 → 2 989 391)");
  });

  it("sorts « 7 j » from the biggest fall up, then the other way, the unknown last", () => {
    const doc = membersPage();
    addMembersColumns(
      doc,
      {
        myPseudo: "Me",
        evolution: new Map([
          ["alpha", { live: 1100, midnight: 1000, weekAgo: 1000 }],
          ["me", { live: 500, midnight: 500, weekAgo: 1000 }],
        ]),
      },
      now,
    );
    clickHeader(doc, 1);
    expect(pseudos(doc).slice(0, 2)).toEqual(["Me", "Alpha"]);
    clickHeader(doc, 1);
    expect(pseudos(doc).slice(0, 2)).toEqual(["Alpha", "Me"]);
  });

  it("adds a « Rôle » column with the role's colour, sorted from the granaries down", () => {
    const doc = membersPage();
    const roles = rolesOfMembers(players, "Me", new Map(), {
      roles: { [String(me.id)]: { kind: "hunter" }, [String(alpha.id)]: { kind: "granary", rank: 1 } },
      styles: {},
    });
    addMembersColumns(doc, { ...withTrips(), roles }, now);
    expect(column(doc, 1).slice(0, 4)).toEqual(["Rôle", "Grenier 1", "Chasseur", "?"]);
    const pill = doc.querySelector<HTMLElement>(".optizzz-members-role");
    expect(pill?.style.getPropertyValue("--role-color")).toBe("#c5130f");
    expect(doc.querySelector(`tr.${ME_CLASS}`)?.querySelector("a")?.textContent).toBe("Me");

    clickHeader(doc, 1);
    expect(pseudos(doc).slice(0, 2)).toEqual(["Alpha", "Me"]);
    expect(header(doc, 0)?.classList.contains("forwardSort")).toBe(false);
  });

  it("says under the role who a member is bigger or smaller than, in the rungs next to its own", () => {
    const doc = membersPage();
    const roles = rolesOfMembers(players, "Me", new Map([["Me", 3000]]), {
      roles: { [String(me.id)]: { kind: "hunter" }, [String(alpha.id)]: { kind: "granary", rank: 1 } },
      styles: {},
    });
    expect(roles.get("me")?.place).toEqual({ kind: "up", than: "Alpha", thanRole: { kind: "granary", rank: 1 } });
    expect(roles.get("alpha")?.place).toEqual({ kind: "down", than: "Me", thanRole: { kind: "hunter" } });
    addMembersColumns(doc, { ...withTrips(), roles }, now);
    expect(column(doc, 1).slice(1, 3)).toEqual(["Grenier 1↑", "Chasseur↓"]);
    expect(doc.querySelector(".optizzz-rung-place")?.getAttribute("aria-label")).toBe(
      "Plus petit que Me (Chasseur), de l'échelon du dessous : doit flooder pour revenir à son échelon.",
    );
  });

  it("drops its arrow when the game sorts by one of its own columns", () => {
    const doc = membersPage();
    addMembersColumns(doc, withTrips(), now);
    clickHeader(doc);
    const trigger = doc.createElement("a");
    trigger.className = "fdTableSortTrigger";
    table(doc)?.rows[0]?.cells[3]?.append(trigger);
    trigger.click();
    expect(header(doc)?.classList.contains("forwardSort")).toBe(false);
  });

  it("can be taken away and added again", () => {
    const doc = membersPage();
    addMembersColumns(doc, withTrips(), now);
    removeMembersColumns(doc);
    expect(doc.querySelectorAll(`.${COLUMN_CLASS}, .${ME_CLASS}`)).toHaveLength(0);
    addMembersColumns(doc, withTrips(), now);
    expect(column(doc)[0]).toBe("Trajet");
  });
});

describe("column picker", () => {
  const withEverything = (): MembersColumnsContext => ({
    myPseudo: "Me",
    trips: { byPseudo: tripsFrom(players, "Me", 3) },
    evolution: new Map([["alpha", { live: 1100, midnight: 1000, weekAgo: 1000 }]]),
  });
  /** Whether each header shows, by its text. */
  const headers = (doc: Document) =>
    Object.fromEntries(
      [...(table(doc)?.rows[0]?.cells ?? [])]
        .filter((cell) => cell.textContent.trim())
        .map((cell) => [cell.textContent.trim(), !cell.classList.contains(HIDDEN_CLASS)]),
    );
  const alphaCells = (doc: Document) =>
    [...(table(doc)?.rows[1]?.cells ?? [])].filter((cell) => !cell.classList.contains(HIDDEN_CLASS)).length;

  it("hides the columns asked, the game's and Optizzz's, merged header cells included", () => {
    const doc = membersPage();
    addMembersColumns(doc, withEverything(), now);
    const before = alphaCells(doc);
    hideMembersColumns(doc, new Set(["grade", "state", "today"]));
    expect(headers(doc)).toEqual({
      Rang: false,
      Pseudo: true,
      Terrain: true,
      "Tech.": true,
      "Fourm.": true,
      Etat: false,
      Trajet: true,
      "Auj.": false,
      "7 j": true,
    });
    // Rang, the two cells under « Etat », Aujourd'hui.
    expect(alphaCells(doc)).toBe(before - 4);
    hideMembersColumns(doc, new Set());
    expect(alphaCells(doc)).toBe(before);
  });

  it("lists the columns that can be hidden, ticked when shown, and says the new choice on a click", () => {
    const doc = membersPage();
    addMembersColumns(doc, withEverything(), now);
    const chosen: Set<string>[] = [];
    addColumnPicker(doc, new Set(["technology"]), (hidden) => chosen.push(new Set(hidden)));
    const boxes = [...doc.querySelectorAll<HTMLInputElement>(".optizzz-columns-picker input")];
    expect(boxes.map((box) => [box.closest("label")?.textContent.trim(), box.checked])).toEqual([
      ["Rang", true],
      ["Technologie", false],
      ["Fourmilière", true],
      ["État", true],
      ["Trajet", true],
      ["Aujourd'hui", true],
      ["7 j", true],
    ]);
    boxes[0]?.click();
    expect(chosen).toEqual([new Set(["technology", "grade"])]);
  });

  it("shortens the game's « Technologie » and « Fourmiliere » headers, the full word in their tooltip", () => {
    const doc = membersPage();
    addMembersColumns(doc, withEverything(), now);
    const header = (text: string) =>
      [...(table(doc)?.rows[0]?.cells ?? [])].find((cell) => cell.textContent.trim() === text);
    expect(header("Tech.")?.title).toBe("Technologie");
    expect(header("Fourm.")?.title).toBe("Fourmilière");
    // Once only: the columns added again keep the short headers.
    removeMembersColumns(doc);
    addMembersColumns(doc, withEverything(), now);
    expect(header("Tech.")).toBeDefined();
  });

  it("is built again when Optizzz's columns come after it", () => {
    const doc = membersPage();
    addMembersColumns(doc, { myPseudo: "Me", trips: { byPseudo: tripsFrom(players, "Me", 3) } }, now);
    addColumnPicker(doc, new Set(), () => undefined);
    // The nightly exports arrive: « Aujourd'hui » and « 7 j » are added.
    removeMembersColumns(doc);
    addMembersColumns(doc, withEverything(), now);
    addColumnPicker(doc, new Set(), () => undefined);
    const labels = [...doc.querySelectorAll(".optizzz-columns-picker label")].map((label) => label.textContent.trim());
    expect(labels).toContain("7 j");
    expect(doc.querySelectorAll(".optizzz-columns-picker")).toHaveLength(1);
  });

  it("is added once, above the table", () => {
    const doc = membersPage();
    addMembersColumns(doc, withEverything(), now);
    addColumnPicker(doc, new Set(), () => undefined);
    addColumnPicker(doc, new Set(), () => undefined);
    expect(doc.querySelectorAll(".optizzz-columns-picker")).toHaveLength(1);
    expect(doc.querySelector(".optizzz-columns-picker")?.nextElementSibling).toBe(table(doc));
  });
});
