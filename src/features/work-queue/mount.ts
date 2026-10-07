import { formatDuration, formatEndTime } from "@/utils/time-format";
import { progressOf } from "./progress";
import { readWorkQueue, type WorkQueue } from "./queue";
import { htmlElement } from "@/utils/html";

const EMPTY: Record<WorkQueue["kind"], string> = {
  construction: "Aucune construction en cours",
  research: "Aucune recherche en cours",
};

export interface MountedWorkQueue {
  table: HTMLTableElement;
  /** Redraws the remaining times and progress bars. */
  update: (now: Date) => void;
}

/**
 * Hides the game's « - Champignonnière 9 se termine dans : … » lines and shows a table in their place.
 * The lines are only hidden, so the game's own countdown scripts keep finding their elements.
 */
export function mountWorkQueue(doc: Document, loadedAt: Date): MountedWorkQueue {
  const queue = readWorkQueue(doc, loadedAt);
  const anchor = hideGameLines(doc);

  const table = htmlElement(
    doc,
    "table",
    `<table class="optizzz-work-queue"><thead><tr><th>${queue.kind === "construction" ? "Construction" : "Recherche"}</th>
    <th>État</th><th>Progression</th><th>Temps restant</th><th>Fin</th><th></th></tr></thead>
    <tbody></tbody><tfoot><tr><td colspan="6"></td></tr></tfoot></table>`,
  );
  if (anchor) anchor.before(table);
  else doc.querySelector("#centre")?.prepend(table);

  const update = (now: Date) => {
    render(table, queue, now);
  };
  update(loadedAt);
  return { table, update };
}

function render(table: HTMLTableElement, queue: WorkQueue, now: Date) {
  const body = table.querySelector("tbody");
  const footer = table.querySelector("tfoot td");
  if (!body || !footer) return;

  body.replaceChildren(
    ...queue.items.map((item, index) => {
      const previousEnd = queue.items[index - 1]?.endsAt ?? null;
      const progress = progressOf(item, previousEnd, queue.kind, now);
      const percent = progress ? `${String(Math.round(progress.progress * 100))} %` : "";

      const row = table.ownerDocument.createElement("tr");
      const cells = [
        `${item.name} ${String(item.targetLevel - 1)} → ${String(item.targetLevel)}`,
        index === 0 ? "en cours" : "en attente",
        percent,
        formatDuration(Math.max(0, item.endsAt.getTime() - now.getTime())),
        formatEndTime(item.endsAt, now),
      ].map((text) => {
        const cell = table.ownerDocument.createElement("td");
        cell.textContent = text;
        return cell;
      });

      const bar = table.ownerDocument.createElement("div");
      bar.className = "optizzz-work-queue-bar";
      bar.setAttribute("role", "progressbar");
      bar.style.setProperty("--progress", percent.replace(" ", ""));
      cells[2]?.prepend(bar);

      const cancel = table.ownerDocument.createElement("td");
      if (item.cancelHref) {
        const link = table.ownerDocument.createElement("a");
        link.setAttribute("href", item.cancelHref);
        link.textContent = "Annuler";
        cancel.append(link);
      }
      row.append(...cells, cancel);
      return row;
    }),
  );

  const first = queue.items[0];
  const header = table.querySelector("thead");
  if (header) header.hidden = !first;
  if (!first) footer.textContent = EMPTY[queue.kind];
  else if (queue.full) footer.textContent = `File pleine : prochaine place libre ${formatEndTime(first.endsAt, now)}`;
  else footer.textContent = "";
}

/** Hides each work line and what follows it (end time, line breaks); returns the element after them. */
function hideGameLines(doc: Document): Element | null {
  let last: Element | null = null;
  for (const line of doc.querySelectorAll("strong")) {
    if (!line.querySelector('span[id^="batiment_"], span[id^="recherche_"]')) continue;
    line.hidden = true;
    let next = line.nextElementSibling;
    while (next instanceof HTMLElement && (next.tagName === "BR" || next.tagName === "SMALL")) {
      next.hidden = true;
      next = next.nextElementSibling;
    }
    last = next;
  }
  return last ?? doc.querySelector("#centre .Bas");
}
