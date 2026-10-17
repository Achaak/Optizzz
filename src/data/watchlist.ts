// The players and alliances each server's player watches, with what they last saw of each — see docs/features/suivis.md.
// In storage.sync: the browser carries the list to the player's other devices of the same browser family.
import { storage } from "wxt/utils/storage";

/** Where the player last looked: the export then, and the field (TDC, or the alliance's total) it gave. */
export interface Seen {
  /** UTC date of the export, AAAAMMJJHHmm. */
  version: string;
  field: number;
}

export type WatchEntry = (
  | { kind: "player"; id: number; /** Pseudo when added: the player may change it. */ pseudo: string }
  | { kind: "alliance"; tag: string }
) & { seen: Seen };

export type WatchKey = `player:${number}` | `alliance:${string}`;

/** Per server, players and alliances together: a storage.sync item holds 8 KB, about 200 entries. */
export const WATCH_LIMIT = 100;

const PREFIX = "watchlist:";
const storageKey = (host: string) => `sync:${PREFIX}${host}` as const;

/** Players by id, alliances by tag without its case (the exports do not always keep it). */
export function watchKey(entry: WatchEntry): WatchKey {
  return entry.kind === "player" ? `player:${entry.id}` : `alliance:${entry.tag.toLowerCase()}`;
}

export async function loadWatchlist(host: string): Promise<WatchEntry[]> {
  return (await storage.getItem<WatchEntry[]>(storageKey(host))) ?? [];
}

// Read-modify-write, one at a time: two quick clicks must not both read the old list.
let pending: Promise<unknown> = Promise.resolve();

function update<T>(host: string, change: (entries: WatchEntry[]) => { entries: WatchEntry[]; result: T }): Promise<T> {
  const write = pending.then(async () => {
    const { entries, result } = change(await loadWatchlist(host));
    await storage.setItem(storageKey(host), entries);
    return result;
  });
  pending = write.catch(() => undefined);
  return write;
}

export function addToWatchlist(host: string, entry: WatchEntry): Promise<"added" | "already" | "full"> {
  return update(host, (entries) => {
    if (entries.some((other) => watchKey(other) === watchKey(entry))) return { entries, result: "already" };
    if (entries.length >= WATCH_LIMIT) return { entries, result: "full" };
    return { entries: [...entries, entry], result: "added" };
  });
}

export function removeFromWatchlist(host: string, key: WatchKey): Promise<void> {
  return update(host, (entries) => ({
    entries: entries.filter((entry) => watchKey(entry) !== key),
    result: undefined,
  }));
}

/** Moves the « seen » mark of the entries given, by key. */
export function markSeen(host: string, seen: Partial<Record<WatchKey, Seen>>): Promise<void> {
  return update(host, (entries) => ({
    entries: entries.map((entry) => {
      const mark = seen[watchKey(entry)];
      return mark ? { ...entry, seen: mark } : entry;
    }),
    result: undefined,
  }));
}

/** Servers whose list is not empty, e.g. "s5.fourmizzz.fr". */
export async function watchedHosts(): Promise<string[]> {
  const all = await browser.storage.sync.get(null);
  return Object.entries(all)
    .filter(([key, value]) => key.startsWith(PREFIX) && Array.isArray(value) && value.length > 0)
    .map(([key]) => key.slice(PREFIX.length));
}

/** Calls `onChange` whenever a server's list changes, on this device or synced from another. */
export function watchWatchlist(host: string, onChange: (entries: WatchEntry[]) => void): () => void {
  return storage.watch<WatchEntry[]>(storageKey(host), (entries) => {
    onChange(entries ?? []);
  });
}
