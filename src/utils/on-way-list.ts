// A list of what is on its way (convoys, attacks): one row per item, a live countdown, the arrival time, and a
// button that copies the item as one line of text. Shared by the convoy and attack features.
import { formatEndTime, formatGameDuration } from "./time-format";

/** The clipboard, given by the caller: tests pass their own. */
export type Copy = (text: string) => Promise<void>;

export interface OnWayItem {
  /** Who it goes to (or comes from, with `incoming`): the game's link, cloned. */
  to: Node;
  /** Coming to me rather than going: « ← de X » in place of « → X ». */
  incoming?: boolean;
  /** What it carries, between the recipient and the time. */
  details: Node[];
  arrivesAt: Date;
  /** Lines under the arrival time, as the game writes them (« Retour le 7 oct. à 21h54 »). */
  notes: string[];
  /** The item as a line to paste elsewhere, its time left counted from `now`. */
  message: (now: Date) => string;
  /** The copy button's tooltip. */
  copyTitle: string;
  /** The game's own link to cancel it (« Annuler »), moved into the row; null when the game offers none. */
  cancel?: HTMLAnchorElement | null;
}

export const ON_WAY_STYLE = `
.optizzz-on-way { margin: var(--optizzz-space-3) 0 10px; padding: 0; overflow: hidden; }
.optizzz-on-way-row {
  display: grid;
  grid-template-columns: minmax(8em, 1.2fr) minmax(12em, 1.4fr) minmax(12em, 1.6fr) auto;
  align-items: center;
  gap: var(--optizzz-space-2) 14px;
  padding: var(--optizzz-space-3) 10px;
}
.optizzz-on-way-row + .optizzz-on-way-row { border-top: 1px solid var(--optizzz-border-soft); }
.optizzz-on-way-row:nth-child(even) { background: var(--optizzz-surface-tint); }
.optizzz-on-way-to { font-weight: bold; overflow-wrap: anywhere; }
.optizzz-on-way-details { display: flex; flex-wrap: wrap; gap: var(--optizzz-space-1) var(--optizzz-space-5); font-variant-numeric: tabular-nums; }
.optizzz-on-way-time { display: flex; flex-direction: column; line-height: 1.3; }
.optizzz-on-way-left { font-weight: bold; font-variant-numeric: tabular-nums; }
.optizzz-on-way-arrived { color: var(--optizzz-success-text); }
.optizzz-on-way-when { font-size: var(--optizzz-font-size-small); color: var(--optizzz-text-muted); }
.optizzz-on-way-actions { display: flex; align-items: center; gap: var(--optizzz-space-3); white-space: nowrap; }
@media (max-width: 700px) {
  .optizzz-on-way-row { grid-template-columns: 1fr auto; }
  .optizzz-on-way-details, .optizzz-on-way-time { grid-column: 1; }
}`;

const COPY_LABEL = "Copier";

export function span(doc: Document, className: string, ...children: (Node | string)[]) {
  const element = doc.createElement("span");
  element.className = className;
  element.append(...children);
  return element;
}

function copyButton(doc: Document, item: OnWayItem, clock: () => Date, copy: Copy) {
  const button = doc.createElement("button");
  button.type = "button";
  button.className = "optizzz-on-way-copy";
  button.textContent = COPY_LABEL;
  button.title = item.copyTitle;
  let reset: ReturnType<typeof setTimeout> | undefined;
  button.addEventListener("click", () => {
    const done = (label: string) => {
      button.textContent = label;
      clearTimeout(reset);
      reset = setTimeout(() => (button.textContent = COPY_LABEL), 3000);
    };
    copy(item.message(clock())).then(
      () => {
        done("Copié !");
      },
      () => {
        done("Copie impossible");
      },
    );
  });
  return button;
}

/**
 * The list, its countdown started: `className` tells it apart on the page. `stop` ends the countdown.
 * The time left reads « dans 1H 22m 22s », as the game writes it, then « arrivé ».
 */
export function renderOnWayList(
  doc: Document,
  className: string,
  items: OnWayItem[],
  clock: () => Date,
  copy: Copy,
): { list: HTMLElement; stop: () => void } {
  const now = clock();
  const list = doc.createElement("div");
  list.className = `optizzz-on-way optizzz-panel optizzz-panel--inset ${className}`;
  const timers: { arrivesAt: Date; left: HTMLElement }[] = [];
  for (const item of items) {
    const left = span(doc, "optizzz-on-way-left");
    timers.push({ arrivesAt: item.arrivesAt, left });
    const when = span(doc, "optizzz-on-way-when", `arrivée ${formatEndTime(item.arrivesAt, now)}`);
    for (const note of item.notes) when.append(doc.createElement("br"), note);

    const row = doc.createElement("div");
    row.className = "optizzz-on-way-row";
    row.append(
      span(doc, "optizzz-on-way-to", item.incoming ? "← de " : "→ ", item.to),
      span(doc, "optizzz-on-way-details", ...item.details),
      span(doc, "optizzz-on-way-time", left, when),
      span(doc, "optizzz-on-way-actions", ...(item.cancel ? [item.cancel] : []), copyButton(doc, item, clock, copy)),
    );
    list.append(row);
  }

  const tick = () => {
    const at = clock();
    for (const { arrivesAt, left } of timers) {
      const ms = arrivesAt.getTime() - at.getTime();
      left.textContent = ms > 0 ? `dans ${formatGameDuration(ms)}` : "arrivé";
      left.classList.toggle("optizzz-on-way-arrived", ms <= 0);
    }
  };
  tick();
  const timer = setInterval(tick, 1000);
  return {
    list,
    stop: () => {
      clearInterval(timer);
    },
  };
}
