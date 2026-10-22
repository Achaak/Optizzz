import { describe, expect, it } from "vitest";
import type { Player } from "@optizzz/game/exports";
import membersHtml from "@optizzz/game/pages/__fixtures__/members.html?raw";
import { addMembersColumns, COLUMN_CLASS, ME_CLASS, removeMembersColumns, type MembersColumnsContext } from "./mount";
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
    expect(roles.get("me")?.role).toEqual({ kind: "granary" });
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

  it("adds a « Rôle » column with the role's colour, sorted from the granaries down", () => {
    const doc = membersPage();
    const roles = rolesOfMembers(players, "Me", new Map(), {
      roles: { [String(me.id)]: { kind: "hunter" }, [String(alpha.id)]: { kind: "granary" } },
      styles: {},
    });
    addMembersColumns(doc, { ...withTrips(), roles }, now);
    expect(column(doc, 1).slice(0, 4)).toEqual(["Rôle", "Grenier", "Chasseur", "?"]);
    const pill = doc.querySelector<HTMLElement>(".optizzz-members-role");
    expect(pill?.style.getPropertyValue("--role-color")).toBe("#c5130f");
    expect(doc.querySelector(`tr.${ME_CLASS}`)?.querySelector("a")?.textContent).toBe("Me");

    clickHeader(doc, 1);
    expect(pseudos(doc).slice(0, 2)).toEqual(["Alpha", "Me"]);
    expect(header(doc, 0)?.classList.contains("forwardSort")).toBe(false);
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
