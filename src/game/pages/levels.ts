// Reading every level of construction.php and laboratoire.php (docs/research/fourmizzz-pages.md).
import { BUILDINGS, RESEARCH, sameName, type BuildingKey, type ResearchKey } from "@/game/levels";

/** Name → current level of each row; « niveau 8 -> 9 » (under way) is level 8. */
function readRows<K extends string>(
  doc: Document,
  list: readonly { key: K; name: string }[],
): Partial<Record<K, number>> {
  const levels: Partial<Record<K, number>> = {};
  for (const row of doc.querySelectorAll(".ligneAmelioration")) {
    const name = row.querySelector("h2")?.textContent ?? "";
    const entry = list.find((candidate) => sameName(candidate.name, name));
    const level = /\d+/.exec(row.querySelector(".niveau_amelioration")?.textContent ?? "");
    if (entry && level) levels[entry.key] = Number(level[0]);
  }
  return levels;
}

export const readBuildingLevels = (doc: Document): Partial<Record<BuildingKey, number>> => readRows(doc, BUILDINGS);

export const readResearchLevels = (doc: Document): Partial<Record<ResearchKey, number>> => readRows(doc, RESEARCH);
