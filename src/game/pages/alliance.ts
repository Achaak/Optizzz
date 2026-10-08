// Reading game pages. Selectors are documented in docs/research/fourmizzz-pages.md.
import { parseGameInteger } from "@/utils/game-number";

const PSEUDO_CELL = 3;
const HUNTING_FIELD_CELL = 5;

/** Each member's hunting field ("TDC", cm²), read live on alliance.php?Membres, by nickname. */
export function readMembersHuntingField(doc: Document): Map<string, number> {
  const fields = new Map<string, number>();
  for (const row of doc.querySelectorAll<HTMLTableRowElement>("#tabMembresAlliance tr")) {
    const pseudo = row.cells[PSEUDO_CELL]?.querySelector("a")?.textContent.trim();
    const field = row.cells[HUNTING_FIELD_CELL]?.textContent;
    if (pseudo && field) fields.set(pseudo, parseGameInteger(field));
  }
  return fields;
}

export function readLoggedInPseudo(doc: Document): string | null {
  const pseudo = doc.querySelector("#pseudo")?.textContent.trim();
  if (!pseudo) return null;
  return pseudo;
}
