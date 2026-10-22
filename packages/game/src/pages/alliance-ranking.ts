// The public page of an alliance, classementAlliance.php?alliance=TAG — see docs/research/fourmizzz-pages.md.
import { parseGameInteger } from "../format/game-number";

export interface AllianceScores {
  members: number;
  /** Total hunting field (TDC), cm². */
  field: number;
  building: number;
  technology: number;
  trophy: number;
}

export interface AllianceRanking {
  name: string;
  /** Live totals. */
  scores: Partial<AllianceScores>;
  /** The game's ranks, 1 = best. */
  ranks: Partial<Record<keyof AllianceScores, number>>;
}

const ROWS: Record<string, keyof AllianceScores> = {
  Terrain: "field",
  Fourmilière: "building",
  Technologie: "technology",
  Combat: "trophy",
  Membres: "members",
};

/** The table after the « Classement » title. */
export function findAllianceRankingTable(doc: Document): HTMLTableElement | null {
  const title = [...doc.querySelectorAll("#centre h2")].find((h2) => h2.textContent.trim() === "Classement");
  const table = title?.nextElementSibling;
  return table instanceof HTMLTableElement ? table : null;
}

/** The alliance shown, or null when the tag is unknown (empty title) or the page is not an alliance's. */
export function readAllianceRanking(doc: Document): AllianceRanking | null {
  const name = doc.querySelector("#centre > h2")?.textContent.trim();
  const table = findAllianceRankingTable(doc);
  if (!name || !table) return null;

  // A row missing or renamed gives nothing, rather than a fall to 0.
  const ranking: AllianceRanking = { name, scores: {}, ranks: {} };
  for (const row of table.rows) {
    const metric = ROWS[row.cells[0]?.textContent.trim() ?? ""];
    const [value, rank] = [row.cells[1]?.textContent, row.cells[2]?.textContent];
    if (!metric || !value) continue;
    ranking.scores[metric] = parseGameInteger(value);
    if (rank) ranking.ranks[metric] = parseGameInteger(rank);
  }
  return ranking;
}
