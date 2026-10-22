// Which nightly exports the curves still lack — see docs/features/site-public.md.
import { dailyVersions, parisDayOf, versionDate } from "@optizzz/game/export-versions";

export interface DayVersion {
  /** Paris day, YYYY-MM-DD. */
  day: string;
  /** The first export of that day. */
  version: string;
}

/**
 * The days of `versions` not yet in `stored`, oldest first, at most `limit` of them: a first run takes back the
 * history a few days at a time instead of downloading every export at once.
 */
export function missingDays(
  versions: readonly string[],
  stored: ReadonlySet<string>,
  now: Date,
  limit: number,
): DayVersion[] {
  return dailyVersions(versions, null, now)
    .map((version) => ({ day: parisDayOf(versionDate(version)), version }))
    .filter(({ day }) => !stored.has(day))
    .slice(0, limit);
}

/** A Paris day as a date column holds it. */
export const dayColumn = (day: string) => new Date(`${day}T00:00:00Z`);

/** A date column back to its Paris day. */
export const columnDay = (date: Date) => date.toISOString().slice(0, 10);
