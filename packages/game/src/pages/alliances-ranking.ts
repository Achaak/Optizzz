// The ranking of every alliance, classement.php?type_classement=alliance_total — see docs/research/fourmizzz-pages.md.

interface RankedAllianceRow {
  /** As the link writes it. */
  tag: string;
  row: HTMLTableRowElement;
}

export interface AlliancesRankingTable {
  table: HTMLTableElement;
  /** What the game fills again over AJAX on a change of criterion, page or league: #zone_classement. */
  zone: HTMLElement;
  /** Rows without an alliance: the column titles. */
  headers: HTMLTableRowElement[];
  alliances: RankedAllianceRow[];
}

const ALLIANCE_LINK = "a[href*='classementAlliance.php?alliance=']";

const tagOf = (row: HTMLTableRowElement): string | null => {
  const href = row.querySelector(ALLIANCE_LINK)?.getAttribute("href");
  if (!href) return null;
  const tag = new URL(href, "https://fourmizzz.fr/").searchParams.get("alliance");
  if (!tag) return null;
  return tag;
};

/** The players' ranking is the same page, its rows linking to their alliance too: only the menu tells them apart. */
const isAlliancesRanking = (doc: Document) =>
  doc.querySelector<HTMLSelectElement>("#type_classement")?.value.startsWith("alliance") ?? false;

/**
 * The table of the ranking: in #centre, the one with the most links to an alliance's page. Read by its links
 * rather than by column, so a column added or moved by the game changes nothing. Null when there is none, or on the
 * players' ranking.
 */
export function readAlliancesRanking(doc: Document): AlliancesRankingTable | null {
  if (!isAlliancesRanking(doc)) return null;
  const tables = [...doc.querySelectorAll<HTMLTableElement>("#centre table")];
  const count = (table: HTMLTableElement) =>
    [...table.rows].filter((row) => row.closest("table") === table && tagOf(row) !== null).length;
  const table = tables.reduce<HTMLTableElement | null>(
    (best, candidate) => (count(candidate) > (best ? count(best) : 0) ? candidate : best),
    null,
  );
  const zone = table?.closest<HTMLElement>("#zone_classement") ?? table?.parentElement;
  if (!table || !zone) return null;

  const ranking: AlliancesRankingTable = { table, zone, headers: [], alliances: [] };
  for (const row of table.rows) {
    if (row.closest("table") !== table) continue;
    const tag = tagOf(row);
    if (tag) ranking.alliances.push({ tag, row });
    else if (row.querySelector("th")) ranking.headers.push(row);
  }
  return ranking;
}
