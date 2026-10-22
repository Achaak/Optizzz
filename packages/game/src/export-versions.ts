// Versions of the public exports (AAAAMMJJHHmm, UTC): one per hour, the first of each Paris day is the nightly one.
/** UTC date of a version (AAAAMMJJHHmm). */
export function versionDate(version: string): Date {
  const [year, month, day, hour, minute] = [0, 4, 6, 8, 10].map((start, i) =>
    Number(version.slice(start, start + (i === 0 ? 4 : 2))),
  ) as [number, number, number, number, number];
  return new Date(Date.UTC(year, month - 1, day, hour, minute));
}

const parisDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" });

/** Paris calendar day, YYYY-MM-DD. */
export const parisDayOf = (date: Date) => parisDay.format(date);

/**
 * The first version of each Paris day (the nightly export, published once and never changed),
 * oldest first. `days` counts today; null keeps every day.
 */
export function dailyVersions(versions: readonly string[], days: number | null, now: Date): string[] {
  const firstDay = days === null ? "" : parisDayOf(new Date(now.getTime() - (days - 1) * 24 * 3600 * 1000));
  const byDay = new Map<string, string>();
  for (const version of [...versions].sort()) {
    const day = parisDayOf(versionDate(version));
    if (day >= firstDay && !byDay.has(day)) byDay.set(day, version);
  }
  return [...byDay.values()];
}
