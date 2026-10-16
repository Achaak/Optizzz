// A line in the rows of construction.php or laboratoire.php that end sooner when ordered after the next level of
// Architecture (buildings) or Salle d'analyse (research). See docs/features/conseils-recherche.md.
import { bestSpeedUp } from "@/game/speed-up";
import { placeInRow } from "@/utils/row-extras";
import { formatDuration, formatEndTime } from "@/utils/time-format";
import type { SpeedUpSource, TimedRow } from "./speed-up-rows";

export const SPEED_UP_STYLE = `
.optizzz-speed-up { margin-top: var(--optizzz-space-2); display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 var(--optizzz-space-3); }
.optizzz-speed-up strong { color: var(--optizzz-success-text); }
.optizzz-speed-up-when { color: var(--optizzz-text-muted); font-size: var(--optizzz-font-size-small); }`;

/** « d'Architecture 8 », « de la Salle d'analyse 4 ». */
const of = (name: string) => (/^[aeiouéèh]/i.test(name) ? `d'${name}` : `de la ${name}`);

/** What the line says, with the plan that ends the row soonest; null when no plan ends it sooner. */
export function speedUpText(row: TimedRow, speedUp: SpeedUpSource, rowStartsAt: Date, now: Date) {
  const best = bestSpeedUp({ now, duration: row.duration, startsAt: rowStartsAt }, speedUp.plans);
  if (!best) return null;
  const { plan, saved, endsNow, endsAfter } = best;
  const target = speedUp.level + plan.levels;
  const added = plan.levels - speedUp.queued;
  const lead =
    added === 0
      ? `Attendez la fin ${of(`${speedUp.name} ${String(target)}`)} :`
      : added === 1 && speedUp.queued === 0
        ? `${speedUp.name} ${String(target)} d'abord :`
        : `${speedUp.name} jusqu'au niveau ${String(target)} d'abord :`;
  return {
    lead,
    strong: `fin ${formatDuration(saved)} plus tôt`,
    when: `(${formatEndTime(endsAfter, now)} au lieu de ${formatEndTime(endsNow, now)})`,
    title: `${speedUp.name} ${String(target)} fini ${formatEndTime(plan.ready, now)}`,
  };
}

/** Adds the line to the row when waiting is worth it; returns it, or null. */
export function mountSpeedUp(row: TimedRow, speedUp: SpeedUpSource, rowStartsAt: Date, now: Date): HTMLElement | null {
  const text = speedUpText(row, speedUp, rowStartsAt, now);
  if (!text) return null;
  const doc = row.description.ownerDocument;
  const line = doc.createElement("div");
  line.title = `Optizzz : ${text.title}. Chaque niveau de ${speedUp.name} réduit le temps de 10 %, et dure plus longtemps que le précédent ; le temps est fixé à la commande. Ce que coûte ${speedUp.name} n'est pas déduit des ressources de la ligne.`;
  const tag = doc.createElement("span");
  tag.className = "optizzz-advice-tag optizzz-tag";
  tag.textContent = "Conseil";
  const strong = doc.createElement("strong");
  strong.textContent = text.strong;
  const when = doc.createElement("span");
  when.className = "optizzz-speed-up-when";
  when.textContent = text.when;
  line.append(tag, " ", text.lead, " ", strong, " ", when);
  placeInRow(row.description, "optizzz-speed-up", line);
  return line;
}
