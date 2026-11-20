// When a player's field moves, from the hourly exports: see docs/features/analyse-joueurs.md. A gain lands when a hunt
// or a flood comes back, hours after the click: this says when the field moves, never when the player is connected.
import { parisDayOf } from "../export-versions";

/** A move of the field between two exports: from `since` to `at`. */
export interface FieldChange {
  since: Date;
  at: Date;
  delta: number;
}

/** Counts by Paris weekday (Monday first) then hour. */
export type WeekGrid = number[][];

/** Two exports further apart than this: when the field moved is unknown (the cron missed an hour). */
const MAX_GAP_MS = 75 * 60_000;

const parisParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Paris",
  weekday: "short",
  hour: "numeric",
  hourCycle: "h23",
});
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Paris weekday (0: Monday) and hour of `date`. */
function parisSlot(date: Date): { weekday: number; hour: number } {
  const parts = parisParts.formatToParts(date);
  const weekday = WEEKDAYS.indexOf(parts.find((part) => part.type === "weekday")?.value ?? "");
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  return { weekday, hour };
}

/** The changes an hour wide: a change counts for the hour it started in (13 h for « entre 13 h et 14 h »). */
const timed = (changes: readonly FieldChange[]) =>
  changes.filter((change) => change.delta !== 0 && change.at.getTime() - change.since.getTime() <= MAX_GAP_MS);

const emptyGrid = (): WeekGrid => Array.from({ length: 7 }, () => Array<number>(24).fill(0));

export function activityGrid(changes: readonly FieldChange[]): { rises: WeekGrid; falls: WeekGrid } {
  const rises = emptyGrid();
  const falls = emptyGrid();
  for (const change of timed(changes)) {
    const { weekday, hour } = parisSlot(change.since);
    const row = (change.delta > 0 ? rises : falls)[weekday];
    if (row) row[hour] = (row[hour] ?? 0) + 1;
  }
  return { rises, falls };
}

/** A run of hours, `from` included, `to` excluded, that may go past midnight: 23 h – 6 h. */
export interface QuietHours {
  from: number;
  to: number;
}

/** A run shorter than this says nothing. */
const MIN_QUIET_HOURS = 3;

/**
 * The longest run of Paris hours where the field rose on at most a quarter of the `days` read (« no rise 3 weeks out
 * of 4 »); null when nothing rose at all (inactive, not quiet) or the run is under 3 hours.
 */
export function quietHours(changes: readonly FieldChange[], days: number): QuietHours | null {
  const risingDays = Array.from({ length: 24 }, () => new Set<string>());
  for (const change of timed(changes)) {
    if (change.delta <= 0) continue;
    risingDays[parisSlot(change.since).hour]?.add(parisDayOf(change.since));
  }
  const quiet = risingDays.map((rising) => rising.size <= days / 4);
  if (quiet.every(Boolean)) return null;
  // Around the clock from an hour that is not quiet: a run past midnight stays whole.
  const start = quiet.indexOf(false);
  let best: QuietHours | null = null;
  let length = 0;
  let bestLength = 0;
  for (let step = 1; step <= 24; step++) {
    const hour = (start + step) % 24;
    if (quiet[hour]) {
      length++;
      if (length > bestLength) {
        bestLength = length;
        best = { from: (hour - length + 1 + 24) % 24, to: (hour + 1) % 24 };
      }
    } else length = 0;
  }
  return bestLength >= MIN_QUIET_HOURS ? best : null;
}
