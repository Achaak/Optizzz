// The « Graphique » column of the alliances' ranking and the colour of each curve — see docs/features/statistiques-alliance.md.
import { sameTag } from "@/game/diplomacy";
import { readAlliancesRanking, type AlliancesRankingTable } from "@/game/pages/alliances-ranking";
import { CHART_COLORS } from "@/theme";

/** One colour each, never twice on the chart: mine and up to seven others. */
export const MAX_SHOWN = CHART_COLORS.series.length;

export const CURVE_COLUMN_CLASS = "optizzz-ranking-curve";

export const RANKING_COLUMN_STYLE = `
.${CURVE_COLUMN_CLASS} { text-align: center; white-space: nowrap; }
.${CURVE_COLUMN_CLASS} label { display: inline-flex; align-items: center; gap: var(--optizzz-space-2); cursor: pointer; }
.${CURVE_COLUMN_CLASS} label:has(input:disabled) { cursor: default; }
.${CURVE_COLUMN_CLASS} input { margin: 0; cursor: inherit; }
.${CURVE_COLUMN_CLASS} .optizzz-ranking-swatch { width: 10px; height: 10px; border-radius: 2px; }`;

export interface CurveCell {
  tag: string;
  cell: HTMLTableCellElement;
}

/** Adds the column at the end of the rows, where the game's sorting does not look. Once only. */
export function addCurveColumn(ranking: AlliancesRankingTable): CurveCell[] {
  const doc = ranking.table.ownerDocument;
  if (ranking.table.querySelector(`.${CURVE_COLUMN_CLASS}`)) return [];
  for (const row of ranking.headers) {
    const header = doc.createElement("th");
    header.className = CURVE_COLUMN_CLASS;
    header.textContent = "Graphique";
    header.title = "Cochez une alliance pour voir ses courbes au-dessus du tableau.";
    row.append(header);
  }
  return ranking.alliances.map(({ tag, row }) => {
    const cell = doc.createElement("td");
    cell.className = CURVE_COLUMN_CLASS;
    row.append(cell);
    return { tag, cell };
  });
}

/**
 * Adds the column again each time the game draws the table anew (criterion, page, league, a click on a title) and
 * hands the new cells over. Returns what stops following.
 */
export function followRanking(zone: HTMLElement, onCells: (cells: CurveCell[]) => void): () => void {
  const observer = new MutationObserver(() => {
    const ranking = readAlliancesRanking(zone.ownerDocument);
    if (!ranking) return;
    const cells = addCurveColumn(ranking);
    if (cells.length > 0) onCells(cells);
  });
  observer.observe(zone, { childList: true });
  return () => observer.disconnect();
}

/**
 * A colour for each tag, the one it had before when it still can: an alliance keeps its colour while others come
 * and go. The new ones take the first colour left, in the palette's order.
 */
export function assignColors(
  tags: readonly string[],
  previous: ReadonlyMap<string, string>,
  palette: readonly string[] = CHART_COLORS.series,
): Map<string, string> {
  const colors = new Map<string, string>();
  const used = new Set<string>();
  const before = (tag: string) => [...previous].find(([other]) => sameTag(other, tag))?.[1];
  for (const tag of tags) {
    const color = before(tag);
    if (color && !used.has(color)) {
      colors.set(tag, color);
      used.add(color);
    }
  }
  for (const tag of tags) {
    if (colors.has(tag)) continue;
    const color = palette.find((candidate) => !used.has(candidate)) ?? palette[colors.size % palette.length];
    if (!color) continue;
    colors.set(tag, color);
    used.add(color);
  }
  return colors;
}
