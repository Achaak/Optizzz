// Reine.php as the laying templates read it: the queue (docs/research/fourmizzz-pages.md, « Reine.php »).
import type { Place } from "@/game/army/battle";
import { unitKeyOf } from "@/game/army/units";
import { parseGameInteger } from "@/utils/game-number";
import { WORKER, type TemplateLine } from "./template";

/** « Loge Impériale », « Terrain de Chasse », « Fourmilière » (the Dôme's garrison). */
function placeOf(garrison: string): Place {
  if (/loge/i.test(garrison)) return "lodge";
  if (/terrain/i.test(garrison)) return "field";
  return "nest";
}

/** « Pontes en cours » as template lines, in queue order; the first one counts the units still to lay. */
export function readQueueLines(doc: Document): TemplateLine[] {
  return [...doc.querySelectorAll('span[id^="ponte_"]')].flatMap((countdown) => {
    const cells = countdown.closest("tr")?.querySelectorAll("td");
    const units = cells?.[0]?.textContent.replace(/\s+/g, " ").trim() ?? "";
    const match = /^([\d\s]+)\s+(\D.*)$/.exec(units);
    if (!match?.[1] || !match[2]) return [];
    const unit = /^ouvri[eè]res?$/i.test(match[2]) ? WORKER : unitKeyOf(match[2]);
    if (!unit) return [];
    return [{ unit, destination: placeOf(cells?.[1]?.textContent ?? ""), amount: parseGameInteger(match[1]) }];
  });
}
