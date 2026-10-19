// The total of workers under the header's workers line (#boiteInfo), those carrying convoys included.
import { formatAmount } from "@/utils/number-format";
import { formatEndTime, formatPastTime } from "@/utils/time-format";
import { setHeaderTip } from "@/utils/header-tip";
import type { WorkersAway } from "./convoy";

const LINE_CLASS = "optizzz-convoy-workers";

export const CONVOY_WORKERS_STYLE = `.${LINE_CLASS} { font-size: 0.8em; line-height: 1.2; padding: 1px 0 2px; }`;

export interface ConvoyWorkers {
  /** The header's count, read with the page: the game takes the workers carrying a convoy off it. */
  atHome: number;
  /** Convoys on their way when the page was read. */
  away: WorkersAway[];
  /** When commerce.php was read. */
  readAt: Date;
  /** Read too long ago, or the background read failed: a convoy may have left or arrived since. */
  stale: boolean;
  /** Without the Étable à pucerons level, a worker counts as carrying 10 resources: an upper bound. */
  aphidsKnown: boolean;
}

/** Adds (or redraws) the total under the workers line; nothing while no convoy is on its way. */
export function renderConvoyWorkers(doc: Document, state: ConvoyWorkers, now: Date): void {
  for (const old of doc.querySelectorAll(`.${LINE_CLASS}`)) old.remove();
  const cell = doc.querySelector("#boiteInfo .icone_ouvriere_boite_info")?.closest("td.tooltip_boite_info");
  if (!cell || state.away.length === 0) return;

  const away = state.away.reduce((sum, convoy) => sum + convoy.workers, 0);
  const line = doc.createElement("div");
  line.className = LINE_CLASS;
  line.textContent = `Total ${formatAmount(state.atHome + away)} · ${formatAmount(away)} en convoi`;
  setHeaderTip(line, tooltip(state, now));
  cell.append(line);
}

function tooltip(state: ConvoyWorkers, now: Date): string {
  const lines = [
    "Ouvrières en convoi, de retour à l'arrivée :",
    ...state.away.map(
      (convoy) => `${formatAmount(convoy.workers)} → ${convoy.recipient}, ${formatEndTime(convoy.backAt, now)}`,
    ),
    "Comptées d'après les ressources portées.",
  ];
  if (!state.aphidsKnown) lines.push("Étable à pucerons inconnue : ouvrez Construction pour un compte exact.");
  if (state.stale) lines.push(`Convois lus ${formatPastTime(state.readAt, now)} : ouvrez Convois pour les revoir.`);
  return lines.join("\n");
}
