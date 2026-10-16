// The rows of construction.php and laboratoire.php the speed-up advice needs: time, cost, level, requirements, and
// when each could start (paid, then its queue free), as the resource forecast counts it.
import { timeToAfford, type ColonyState } from "@/game/forecast";
import { speedUpLevels, type SpeedUpLevel } from "@/game/speed-up";
import { sameName } from "@/game/levels";
import { readCosts, type Cost } from "@/game/pages/resources";
import { parseGameDuration, readWorkQueue } from "@/game/pages/work-queue";

export interface TimedRow {
  name: string;
  /** Highest level shown (« niveau 14 -> 15 » while under way: 15). */
  level: number;
  /** Time of the next level, as the game shows it. */
  duration: number;
  cost: Cost;
  /** A requirement is missing. */
  locked: boolean;
  /** Where the advice goes. */
  description: Element;
}

export function readTimedRows(doc: Document): TimedRow[] {
  const costs = readCosts(doc);
  return [...doc.querySelectorAll(".ligneAmelioration")].flatMap((row) => {
    const description = row.querySelector(".desciption_amelioration");
    const name = description?.querySelector("h2")?.textContent.trim();
    const duration = parseGameDuration(row.querySelector(".cout_amelioration .temps")?.textContent ?? "");
    const levels = [...(row.querySelector(".niveau_amelioration")?.textContent ?? "").matchAll(/\d+/g)].map(Number);
    const cost = costs.find((candidate) => candidate.description === description)?.cost;
    if (!description || !name || duration === null || !cost) return [];
    return [
      {
        name,
        level: Math.max(0, ...levels),
        duration,
        cost,
        locked: !!row.querySelector(".verificationNonOK"),
        description,
      },
    ];
  });
}

/** When the page's queue frees up: the end of its last item, now when idle. */
export function queueEnd(doc: Document, now: Date): Date {
  return new Date(Math.max(now.getTime(), ...readWorkQueue(doc, now).items.map((item) => item.endsAt.getTime())));
}

/**
 * When a row would start if ordered as soon as it is paid: after its queue. Without the colony's state, as if paid
 * now; null when it can never be paid at the current pace.
 */
export function startsAt(state: ColonyState | null, cost: Cost, queueFree: Date, now: Date): Date | null {
  const paid = paidAt(state, cost, 1, now);
  return paid && new Date(Math.max(paid.getTime(), queueFree.getTime()));
}

/** The speed-up as the other page shows it: the level the player has, and the plans to raise it. */
export interface SpeedUpSource {
  name: string;
  /** Level done, those queued not counted. */
  level: number;
  /** Levels already queued: the player only has to wait for them. */
  queued: number;
  plans: SpeedUpLevel[];
}

/** When `share` × `cost` is paid; without the colony's state, as if now. */
function paidAt(state: ColonyState | null, cost: Cost, share: number, now: Date): Date | null {
  if (!state) return now;
  const total = { food: cost.food * share, materials: cost.materials * share, workers: cost.workers * share };
  const affordability = timeToAfford(state, total, now);
  return affordability.kind === "now" ? now : affordability.kind === "at" ? affordability.at : null;
}

/** The most levels a plan raises the speed-up by: beyond, the times are days long. */
const MAX_LEVELS = 10;

/** Null when the speed-up can neither be waited for (queued) nor raised (locked, unpaid, absent from `doc`). */
export function readSpeedUp(
  doc: Document,
  name: string,
  growth: number,
  state: ColonyState | null,
  now: Date,
): SpeedUpSource | null {
  const queued = readWorkQueue(doc, now).items.filter((item) => sameName(item.name, name));
  const row = readTimedRows(doc).find((candidate) => sameName(candidate.name, name));
  // The row already shows the cost and time of the level after those queued.
  const level = queued.length ? Math.max(...queued.map((item) => item.targetLevel)) - queued.length : (row?.level ?? 0);
  const start = queueEnd(doc, now);
  const waiting = queued.length
    ? { levels: queued.length, ready: new Date(Math.max(...queued.map((item) => item.endsAt.getTime()))) }
    : null;
  const plans =
    row && !row.locked
      ? speedUpLevels({
          start,
          queued: waiting,
          duration: row.duration,
          growth,
          paidAt: (share) => paidAt(state, row.cost, share, now),
          max: MAX_LEVELS,
        })
      : waiting
        ? [waiting]
        : [];
  return plans.length ? { name, level, queued: queued.length, plans } : null;
}
