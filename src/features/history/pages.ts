// Live scores read on the game pages. Selectors are documented in docs/research/fourmizzz-pages.md.
import type { Scores } from "./api";

const toInteger = (text: string) => Number(text.replace(/\D/g, ""));

// Rows of the profile's `table.tableau_score`, by their label.
const PROFILE_ROWS: Record<string, keyof Scores> = {
  Terrain: "field",
  Fourmilière: "building",
  Technologie: "technology",
  Combat: "trophy",
};

/** The player shown on Membre.php and their live scores, or null on another page. */
export function readProfile(doc: Document): { pseudo: string; scores: Scores } | null {
  const table = doc.querySelector(".boite_membre table.tableau_score");
  const pseudo = doc.querySelector("#centre h2")?.textContent.trim();
  if (!table || !pseudo) return null;

  const scores: Scores = { field: 0, building: 0, technology: 0, trophy: 0 };
  for (const row of table.querySelectorAll("tr")) {
    const metric = PROFILE_ROWS[row.cells[0]?.textContent.trim() ?? ""];
    const value = row.cells[1]?.textContent;
    if (metric && value) scores[metric] = toInteger(value);
  }
  return { pseudo, scores };
}

// Cells of `#tabMembresAlliance`.
const PSEUDO_CELL = 3;
const FIELD_CELL = 5;
const TECHNOLOGY_CELL = 7;
const BUILDING_CELL = 8;

/** Each member's live field, technology and building on alliance.php?Membres, by nickname (no trophies). */
export function readMembersScores(doc: Document): Map<string, Partial<Scores>> {
  const members = new Map<string, Partial<Scores>>();
  for (const row of doc.querySelectorAll<HTMLTableRowElement>("#tabMembresAlliance tr")) {
    const pseudo = row.cells[PSEUDO_CELL]?.querySelector("a")?.textContent.trim();
    const [field, technology, building] = [FIELD_CELL, TECHNOLOGY_CELL, BUILDING_CELL].map(
      (cell) => row.cells[cell]?.textContent,
    );
    if (!pseudo || !field || !technology || !building) continue;
    members.set(pseudo, { field: toInteger(field), technology: toInteger(technology), building: toInteger(building) });
  }
  return members;
}
