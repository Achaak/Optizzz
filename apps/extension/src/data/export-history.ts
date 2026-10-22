// History drawn from the public exports (players, alliances): the API publishes one per hour, the history keeps
// one per day, each cached once and never purged.
import { storage } from "wxt/utils/storage";

/**
 * A published version never changes: read from `key`, or downloaded once then stored there. `complete` tells a
 * cache stored before a field was kept: it is downloaded again.
 */
export async function cachedVersion<T>(
  key: `local:${string}`,
  download: () => Promise<T>,
  complete: (cached: T) => boolean = () => true,
): Promise<T> {
  const cached = await storage.getItem<T>(key);
  if (cached && complete(cached)) return cached;
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
