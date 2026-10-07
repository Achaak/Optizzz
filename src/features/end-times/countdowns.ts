import { formatEndTime } from "@/utils/time-format";

/** A game countdown: `<span id>` kept up to date by the inline script `reste(<seconds>, "<id>")`. */
export interface Countdown {
  id: string;
  seconds: number;
}

// `reste(` only: `reste_unite(…)` counts units and the Compte+ box uses `resteTemps(…)`.
const COUNTDOWN = /\breste\((\d+),\s*["']([^"']+)["']\)/g;

/** Repeats another countdown of the same row: the first laying's own time equals its total time. */
const DUPLICATES = new Set(["temps_restant_premiere_ponte"]);

const GAME_END_TIME = /(Arrivée|Terminé) à \d/;
const INLINE_WRAPPERS = new Set(["SPAN", "STRONG", "EM", "B"]);

export function readCountdowns(doc: Document): Countdown[] {
  const countdowns: Countdown[] = [];
  for (const script of doc.querySelectorAll("script")) {
    for (const [, seconds, id] of script.textContent.matchAll(COUNTDOWN)) {
      if (seconds && id) countdowns.push({ id, seconds: Number(seconds) });
    }
  }
  return countdowns;
}

/**
 * Whether the game prints its own end time after the countdown's line (« Arrivée à 13h11 » under a hunt
 * with Compte+, « Terminé à 13h06 » under a research), before the next countdown.
 */
function gameShowsEndTime(span: Element): boolean {
  let line = span;
  while (line.parentElement && INLINE_WRAPPERS.has(line.parentElement.tagName)) line = line.parentElement;
  for (let next = line.nextElementSibling; next; next = next.nextElementSibling) {
    if (next.matches("script, br")) continue;
    if (next.querySelector("span[id]")) return false;
    if (GAME_END_TIME.test(next.textContent)) return true;
  }
  return false;
}

/** Writes « · fin aujourd'hui 14 h 23 » right after each countdown (outside it: the game rewrites its text). */
export function annotateCountdowns(doc: Document, loadedAt: Date) {
  const labels: { label: HTMLElement; endsAt: Date }[] = [];
  for (const { id, seconds } of readCountdowns(doc)) {
    const span = doc.getElementById(id);
    if (!span || DUPLICATES.has(id) || span.nextElementSibling?.classList.contains("optizzz-end-time")) continue;
    if (gameShowsEndTime(span)) continue;
    const label = doc.createElement("span");
    label.className = "optizzz-end-time";
    span.after(label);
    labels.push({ label, endsAt: new Date(loadedAt.getTime() + seconds * 1000) });
  }

  /** « aujourd'hui » becomes wrong after midnight: the wording is redrawn now and then. */
  const update = (now: Date) => {
    for (const { label, endsAt } of labels) label.textContent = ` · fin ${formatEndTime(endsAt, now)}`;
  };
  update(loadedAt);
  return { update };
}
