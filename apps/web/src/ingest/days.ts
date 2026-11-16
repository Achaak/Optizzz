// Which nightly exports the curves still lack — see docs/features/site-public.md.
import { dailyVersions, parisDayOf, versionDate } from "@optizzz/game/export-versions";

export interface DayVersion {
  /** Paris day, YYYY-MM-DD. */
  day: string;
  /** The first export of that day. */
  version: string;
}

/**
 * The days of `versions` after `latest` (the latest day stored, null for none), oldest first, at most `limit` of
 * them: a first run takes back the history a few days at a time instead of downloading every export at once. Never a
 * day before `latest`: a night's rows only say what changed since the previous night stored.
 */
export function missingDays(
  versions: readonly string[],
  latest: string | null,
  now: Date,
  limit: number,
): DayVersion[] {
  return dailyVersions(versions, null, now)
    .map((version) => ({ day: parisDayOf(versionDate(version)), version }))
    .filter(({ day }) => latest === null || day > latest)
    .slice(0, limit);
}

/** A Paris day as a date column holds it. */
export const dayColumn = (day: string) => new Date(`${day}T00:00:00Z`);

/** A date column back to its Paris day. */
export const columnDay = (date: Date) => date.toISOString().slice(0, 10);
