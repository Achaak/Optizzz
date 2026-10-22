// Live scores read on the game pages. Selectors are documented in docs/research/fourmizzz-pages.md.
import { parseGameInteger } from "../format/game-number";

export interface Scores {
  /** Hunting field (TDC), cm². */
  field: number;
  building: number;
  technology: number;
  /** « Combat » on the profile page. */
  trophy: number;
}

// Rows of the profile's `table.tableau_score`, by their label.
const PROFILE_ROWS: Record<string, keyof Scores> = {
  Terrain: "field",
  Fourmilière: "building",
  Technologie: "technology",
  Combat: "trophy",
};

/** The player shown on Membre.php and their live scores, or null on another page. */
export function readProfile(doc: Document): { pseudo: string; scores: Partial<Scores> } | null {
  const table = doc.querySelector(".boite_membre table.tableau_score");
  const pseudo = doc.querySelector("#centre h2")?.textContent.trim();
  if (!table || !pseudo) return null;

  // A row missing or renamed gives no live point, rather than a fall to 0.
  const scores: Partial<Scores> = {};
  for (const row of table.querySelectorAll("tr")) {
    const metric = PROFILE_ROWS[row.cells[0]?.textContent.trim() ?? ""];
    const value = row.cells[1]?.textContent;
    if (metric && value) scores[metric] = parseGameInteger(value);
  }
  return { pseudo, scores };
}

/** The « Etat : » row of the profile's « Informations » box. */
export function findProfileStateRow(doc: Document): HTMLTableRowElement | null {
  const rows = doc.querySelectorAll<HTMLTableRowElement>(".boite_membre table:not(.tableau_score) tr");
  return [...rows].find((row) => row.cells[0]?.textContent.trim().startsWith("Etat")) ?? null;
}

/**
 * Whether the player shown on Membre.php is free or colonized, and by whom: « Fourmilière libre » or
 * « Fourmilière soumise par <a>Maître</a> ». Null when the row is missing.
 */
export function readProfileState(doc: Document): { master: string | null } | null {
  const cell = findProfileStateRow(doc)?.cells[1];
  if (!cell) return null;
  const colonized = /soumise par\s+(.+)$/i.exec(cell.textContent.trim());
  return { master: colonized?.[1]?.trim() ?? null };
}

// Cells of `#tabMembresAlliance`.
const PSEUDO_CELL = 3;
const FIELD_CELL = 5;
const TECHNOLOGY_CELL = 7;
const BUILDING_CELL = 8;

/** Each member's live field, technology and building on alliance.php?Membres, by nickname (no trophies). */
export function readMembersScores(doc: Document): Map<string, Partial<Scores>> {
  const members = new Map<string, Partial<Scores>>();
  // The header row is skipped: the game's sort script puts links in it (« PSEUDO »).
  for (const row of doc.querySelectorAll<HTMLTableRowElement>("#tabMembresAlliance tr:not(:has(th))")) {
    const pseudo = row.cells[PSEUDO_CELL]?.querySelector("a")?.textContent.trim();
    const [field, technology, building] = [FIELD_CELL, TECHNOLOGY_CELL, BUILDING_CELL].map(
      (cell) => row.cells[cell]?.textContent,
    );
    if (!pseudo || !field || !technology || !building) continue;
    members.set(pseudo, {
      field: parseGameInteger(field),
      technology: parseGameInteger(technology),
      building: parseGameInteger(building),
    });
  }
  return members;
}
