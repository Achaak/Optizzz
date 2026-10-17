// One reading of the exports for a server's watch list: the state of the watched entries, compared with the last
// one, the changes kept in the journal. Run every hour by the background script — see docs/features/suivis.md.
import { storage } from "wxt/utils/storage";
import { loadAlliancesExport, loadPlayersExport } from "@/data/exports";
import { loadWatchlist, watchKey } from "@/data/watchlist";
import { diffStates, fieldLosses, pruneJournal, readState, type JournalEntry, type WatchState } from "./changes";

const stateKey = (host: string) => `local:watchlist:${host}:state` as const;
const journalKey = (host: string) => `local:watchlist:${host}:journal` as const;
const originKey = (host: string) => `local:watchlist:${host}:origin` as const;
const meKey = (host: string) => `local:watchlist:${host}:me` as const;

/**
 * Kept by the content script: the server's origin (S1–S4 are served over HTTP only, the host alone does not tell)
 * and who is logged in there, for the distances.
 */
export async function rememberServer(origin: string, pseudo: string | null = null): Promise<void> {
  const host = new URL(origin).host;
  await storage.setItem(originKey(host), origin);
  if (pseudo) await storage.setItem(meKey(host), pseudo);
}

export function loadMe(host: string): Promise<string | null> {
  return storage.getItem<string>(meKey(host));
}

export async function originOf(host: string): Promise<string> {
  return (await storage.getItem<string>(originKey(host))) ?? `https://${host}`;
}

export function loadJournal(host: string): Promise<JournalEntry[]> {
  return storage.getItem<JournalEntry[]>(journalKey(host)).then((journal) => journal ?? []);
}

export function loadWatchState(host: string): Promise<WatchState | null> {
  return storage.getItem<WatchState>(stateKey(host));
}

export interface Reading {
  state: WatchState;
  /** Changes noticed by this reading. */
  fresh: JournalEntry[];
  losses: ReturnType<typeof fieldLosses>;
}

/**
 * Reads the exports for `host`'s watch list. Null when the list is empty or the players export has not changed since
 * the last reading. The exports come from the shared cache: they are downloaded only when a new version is out.
 */
export async function takeReading(host: string, now: Date): Promise<Reading | null> {
  const entries = await loadWatchlist(host);
  if (entries.length === 0) return null;
  const origin = await originOf(host);
  const previous = await loadWatchState(host);
  const players = await loadPlayersExport(origin);
  if (previous?.version === players.version) return null;
  // The alliances export only for watched alliances; their members come from the players export.
  const alliances = entries.some((entry) => entry.kind === "alliance")
    ? (await loadAlliancesExport(origin)).alliances
    : null;

  const state = readState(entries, players.version, players.players, alliances);
  const fresh = previous ? diffStates(previous, state) : [];
  const losses = previous ? fieldLosses(previous, state) : [];
  const journal = pruneJournal([...(await loadJournal(host)), ...fresh], entries.map(watchKey), now);
  await storage.setItem(stateKey(host), state);
  await storage.setItem(journalKey(host), journal);
  return { state, fresh, losses };
}

/** Calls `onChange` after each reading: the journal and the reading's version. */
export function watchReadings(host: string, onChange: () => void): () => void {
  const stopJournal = storage.watch(journalKey(host), onChange);
  const stopState = storage.watch(stateKey(host), onChange);
  return () => {
    stopJournal();
    stopState();
  };
}
