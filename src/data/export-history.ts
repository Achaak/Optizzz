// History drawn from the public exports (players, alliances): the API publishes one per hour, the history keeps
// one per day, each cached once and never purged.
import { storage } from "wxt/utils/storage";

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

/** A published version never changes: read from `key`, or downloaded once then stored there. */
export async function cachedVersion<T>(key: `local:${string}`, download: () => Promise<T>): Promise<T> {
  const cached = await storage.getItem<T>(key);
  if (cached) return cached;
  const fresh = await download();
  try {
    await storage.setItem(key, fresh);
  } catch (error) {
    console.warn(`[Optizzz] could not cache ${key}`, error);
  }
  return fresh;
}

/**
 * `load` of each of `versions`, in the same order. Loaded latest first, one at a time, with `onProgress` called
 * after each; a version that fails is skipped. Stops once `signal` is aborted (another period chosen, view closed).
 */
export async function loadEachVersion<T>(
  versions: readonly string[],
  load: (version: string) => Promise<T>,
  onProgress?: (loaded: T[]) => void,
  signal?: AbortSignal,
): Promise<T[]> {
  const loaded = new Map<string, T>();
  const inOrder = () => versions.flatMap((version) => (loaded.has(version) ? [loaded.get(version) as T] : []));
  for (const version of [...versions].reverse()) {
    if (signal?.aborted) break;
    try {
      loaded.set(version, await load(version));
    } catch (error) {
      console.warn(`[Optizzz] export ${version} unavailable`, error);
      continue;
    }
    onProgress?.(inOrder());
  }
  return inOrder();
}
