// Which exports make the history: the API publishes one per hour, the history keeps one per day.

/** UTC date of a version (AAAAMMJJHHmm). */
export function versionDate(version: string): Date {
  const [year, month, day, hour, minute] = [0, 4, 6, 8, 10].map((start, i) =>
    Number(version.slice(start, start + (i === 0 ? 4 : 2))),
  ) as [number, number, number, number, number];
  return new Date(Date.UTC(year, month - 1, day, hour, minute));
}

const parisDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" });

/** Paris calendar day, YYYY-MM-DD. */
const dayOf = (date: Date) => parisDay.format(date);

/**
 * The first version of each Paris day (the nightly export, published once and never changed),
 * oldest first. `days` counts today; null keeps every day.
 */
export function dailyVersions(versions: readonly string[], days: number | null, now: Date): string[] {
  const firstDay = days === null ? "" : dayOf(new Date(now.getTime() - (days - 1) * 24 * 3600 * 1000));
  const byDay = new Map<string, string>();
  for (const version of [...versions].sort()) {
    const day = dayOf(versionDate(version));
    if (day >= firstDay && !byDay.has(day)) byDay.set(day, version);
  }
  return [...byDay.values()];
}
