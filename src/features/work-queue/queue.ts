// Reading the work in progress on construction.php and laboratoire.php.
// Structure documented in docs/research/fourmizzz-pages.md (« Chantiers en cours »).

export interface WorkItem {
  name: string;
  targetLevel: number;
  endsAt: Date;
  cancelHref: string | null;
  /** Duration shown on the item's row: the game already shows the level after the target. */
  nextLevelDuration: number | null;
}

export type WorkKind = "construction" | "research";

export interface WorkQueue {
  kind: WorkKind;
  items: WorkItem[];
  /** No free slot: the game offers no « Construire » / « Rechercher » button at all. */
  full: boolean;
}

// « - Champignonnière 9 se termine dans : … » / « - Architecture 1 terminé dans: … »
const ITEM_TEXT = /^-\s*(.+?)\s+(\d+)\s+(?:se termine|terminé) dans/;
const REMAINING_SECONDS = /reste\((\d+)/;

export function readWorkQueue(doc: Document, now: Date): WorkQueue {
  const items: WorkItem[] = [];
  for (const line of doc.querySelectorAll("strong")) {
    if (!line.querySelector('span[id^="batiment_"], span[id^="recherche_"]')) continue;
    const text = ITEM_TEXT.exec(line.textContent.trim());
    const seconds = REMAINING_SECONDS.exec(line.querySelector("script")?.textContent ?? "");
    if (!text?.[1] || !text[2] || !seconds?.[1]) continue;
    items.push({
      name: text[1],
      targetLevel: Number(text[2]),
      endsAt: new Date(now.getTime() + Number(seconds[1]) * 1000),
      cancelHref: line.querySelector("a")?.getAttribute("href") ?? null,
      nextLevelDuration: readRowDuration(doc, text[1]),
    });
  }
  return { kind: readKind(doc), items, full: items.length > 0 && !offersToStart(doc) };
}

/** Buildings have a « Temps de Construction » cost row; research costs are laid out differently. */
function readKind(doc: Document): WorkKind {
  return doc.querySelector('.cout_amelioration tr[title="Temps de Construction"]') ? "construction" : "research";
}

function readRowDuration(doc: Document, name: string): number | null {
  const title = [...doc.querySelectorAll(".ligneAmelioration h2")].find((h2) => h2.textContent.trim() === name);
  const duration = title?.closest(".ligneAmelioration")?.querySelector(".cout_amelioration .temps");
  return duration ? parseGameDuration(duration.textContent) : null;
}

const DURATION_UNITS: Record<string, number> = { j: 86_400, h: 3600, m: 60, s: 1 };

/** « 1H 25m 54s », « 50m 20s » → milliseconds. */
export function parseGameDuration(text: string): number | null {
  let seconds = 0;
  let found = false;
  for (const [, value, unit] of text.matchAll(/(\d+)\s*([jhms])/gi)) {
    seconds += Number(value) * (DURATION_UNITS[(unit ?? "").toLowerCase()] ?? 0);
    found = true;
  }
  return found ? seconds * 1000 : null;
}

/** Whether any row shows a start button, active or greyed out for lack of resources. */
function offersToStart(doc: Document): boolean {
  return !!doc.querySelector(
    '.ligneAmelioration a[href*="Construire="], .ligneAmelioration a[href*="Rechercher="], .ligneAmelioration .bouton_gris',
  );
}
