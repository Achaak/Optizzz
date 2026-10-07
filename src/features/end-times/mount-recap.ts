import { formatDuration, formatEndTimeShort } from "@/utils/time-format";
import type { RecapRow } from "./recap";
import { SOURCE_PAGES, type EndKind } from "./sources";
import { htmlElement } from "@/utils/html";

const ICONS: Record<EndKind, string> = { hunt: "🏹", laying: "🥚", construction: "🔨", research: "🔬", convoy: "🐜" };

/** Space between the recap and the Compte+ box pushed below it. */
const GAP_PX = 5;
/** The box title is 25 px high; the content is placed under it, like the game's boxes. */
const TITLE_PX = 25;

export const RECAP_STYLE = `
.optizzz-recap { position: absolute; left: 65px; width: 220px; color: rgb(211, 217, 184); text-align: center; }
.optizzz-recap .contenu_boite_compte_plus { height: auto; padding: 8px 10px 6px; box-sizing: border-box; text-align: left; }
.optizzz-recap ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.optizzz-recap a { color: inherit; font-weight: normal; text-decoration: none; }
.optizzz-recap li a:hover { text-decoration: underline; }
.optizzz-recap-when { font-size: 0.9em; opacity: 0.85; }
.optizzz-recap-done { font-style: italic; }`;

/**
 * « Prochaines fins » box in the left column, where the Compte+ box sits; that box is pushed below it.
 * Null with Compte+: its own box already lists all this.
 */
export function mountRecap(doc: Document) {
  const comptePlus = doc.querySelector<HTMLElement>("#boiteComptePlus");
  const column = comptePlus?.parentElement;
  if (!comptePlus || !column || comptePlus.querySelector('[id^="ligne_"]')) return null;

  const gameTop = comptePlus.style.top;
  const top = Number.parseFloat(gameTop || getComputedStyle(comptePlus).top) || 200;

  const box = htmlElement(
    doc,
    "div",
    `<div class="optizzz-recap"><div class="titre_colonne_cliquable"><a>Prochaines fins</a></div>
    <div class="contenu_boite_compte_plus"><ul></ul></div></div>`,
  );
  box.style.top = `${String(top)}px`;
  box.hidden = true;
  column.append(box);
  const list = box.querySelector("ul");
  const content = box.querySelector<HTMLElement>(".contenu_boite_compte_plus");

  const render = (rows: RecapRow[], now: Date) => {
    list?.replaceChildren(...rows.map((row) => renderRow(doc, row, now)));
    box.hidden = rows.length === 0;
    comptePlus.style.top = box.hidden ? gameTop : `${String(top + TITLE_PX + (content?.offsetHeight ?? 0) + GAP_PX)}px`;
  };
  return { render };
}

function renderRow(doc: Document, row: RecapRow, now: Date): HTMLElement {
  const item = doc.createElement("li");
  const link = doc.createElement("a");
  link.href = SOURCE_PAGES[row.kind].slice(1);
  link.textContent = `${ICONS[row.kind]} ${row.label}`;
  item.append(link);
  if (row.queued > 0) item.append(` +${String(row.queued)} en file`);

  const when = doc.createElement("div");
  when.className = row.done ? "optizzz-recap-when optizzz-recap-done" : "optizzz-recap-when";
  const parts = row.done
    ? ["terminé"]
    : [formatDuration(row.endsAt.getTime() - now.getTime()), formatEndTimeShort(row.endsAt, now)];
  if (row.stale) parts.push(`vu il y a ${formatDuration(now.getTime() - row.readAt.getTime())}`);
  when.textContent = parts.join(" · ");
  item.append(when);
  return item;
}
